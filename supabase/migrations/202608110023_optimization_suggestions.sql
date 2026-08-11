create table public.optimization_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  suggestion_kind text not null check (suggestion_kind in ('goal_dropoff','entry_underperformance','destination_friction','journey_friction')),
  evidence_key text not null,
  title text not null,
  explanation text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','dismissed','applied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, suggestion_kind, evidence_key)
);

create index optimization_suggestions_project_status_idx on public.optimization_suggestions(project_id, status, created_at desc);
create trigger optimization_suggestions_set_updated_at before update on public.optimization_suggestions for each row execute function public.set_updated_at();
alter table public.optimization_suggestions enable row level security;
create policy "optimization suggestions member all" on public.optimization_suggestions for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and public.project_workspace(project_id) = workspace_id);
