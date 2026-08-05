-- Onboarding adaptativo: sessões, mensagens, execuções de IA e requisitos auditáveis.

create table public.ai_setup_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'collecting' check (status in ('collecting', 'analyzing', 'waiting_answers', 'generating', 'review', 'completed', 'failed')),
  initial_input jsonb not null default '{}'::jsonb,
  extracted_profile jsonb,
  answers jsonb not null default '{}'::jsonb,
  missing_requirements jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  project_draft jsonb,
  last_error text,
  used_fallback boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_setup_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_setup_sessions(id) on delete cascade,
  role text not null check (role in ('assistant', 'user', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  setup_session_id uuid references public.ai_setup_sessions(id) on delete cascade,
  operation text not null,
  provider text not null,
  model text,
  prompt_version text,
  status text not null check (status in ('started', 'completed', 'failed')),
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  duration_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.project_data_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requirement_key text not null,
  label text not null,
  capability_key text not null,
  status text not null check (status in ('verified', 'needs_confirmation', 'missing', 'invalid')),
  severity text not null check (severity in ('blocking', 'warning', 'optional')),
  value jsonb,
  origin text,
  source_id text,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, requirement_key)
);

create index ai_setup_sessions_workspace_updated_idx on public.ai_setup_sessions(workspace_id, updated_at desc);
create index ai_setup_sessions_created_by_idx on public.ai_setup_sessions(created_by, created_at desc);
create index ai_setup_messages_session_idx on public.ai_setup_messages(session_id, created_at);
create index ai_generation_runs_session_idx on public.ai_generation_runs(setup_session_id, created_at desc);
create index ai_generation_runs_workspace_idx on public.ai_generation_runs(workspace_id, created_at desc);
create index project_data_requirements_project_idx on public.project_data_requirements(project_id, status, severity);

create trigger ai_setup_sessions_set_updated_at before update on public.ai_setup_sessions for each row execute function public.set_updated_at();
create trigger project_data_requirements_set_updated_at before update on public.project_data_requirements for each row execute function public.set_updated_at();

alter table public.ai_setup_sessions enable row level security;
alter table public.ai_setup_messages enable row level security;
alter table public.ai_generation_runs enable row level security;
alter table public.project_data_requirements enable row level security;

create policy "ai setup sessions member all" on public.ai_setup_sessions for all to authenticated
  using (created_by = auth.uid() and public.is_workspace_member(workspace_id))
  with check (created_by = auth.uid() and public.is_workspace_member(workspace_id));

create policy "ai setup messages member all" on public.ai_setup_messages for all to authenticated
  using (exists(select 1 from public.ai_setup_sessions s where s.id = session_id and s.created_by = auth.uid() and public.is_workspace_member(s.workspace_id)))
  with check (exists(select 1 from public.ai_setup_sessions s where s.id = session_id and s.created_by = auth.uid() and public.is_workspace_member(s.workspace_id)));

create policy "ai generation runs member select" on public.ai_generation_runs for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "project data requirements member all" on public.project_data_requirements for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));

grant select, insert, update, delete on public.ai_setup_sessions to authenticated;
grant select, insert, update, delete on public.ai_setup_messages to authenticated;
grant select on public.ai_generation_runs to authenticated;
grant select, insert, update, delete on public.project_data_requirements to authenticated;
