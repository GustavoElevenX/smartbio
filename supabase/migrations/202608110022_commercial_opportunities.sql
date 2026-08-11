create table public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.visitor_sessions(id) on delete set null,
  conversion_goal_id uuid references public.conversion_goals(id) on delete set null,
  entry_point_id uuid references public.entry_points(id) on delete set null,
  destination_id uuid references public.routing_destinations(id) on delete set null,
  source_type text not null check (source_type in ('lead','quote','booking','order','reservation','routed_contact')),
  source_id text not null,
  status text not null default 'new' check (status in ('new','in_progress','converted','lost','archived')),
  title text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  summary text,
  estimated_value numeric(14,2),
  confirmed_value numeric(14,2),
  currency text not null default 'BRL',
  loss_reason text,
  first_handled_at timestamptz,
  converted_at timestamptz,
  lost_at timestamptz,
  attribution jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, source_type, source_id),
  check (confirmed_value is null or confirmed_value >= 0)
);

create table public.opportunity_timeline (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete cascade,
  event_type text not null check (event_type in ('created','status_changed','converted','lost','note')),
  label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index commercial_opportunities_workspace_status_idx on public.commercial_opportunities(workspace_id, status, created_at desc);
create index commercial_opportunities_project_status_idx on public.commercial_opportunities(project_id, status, created_at desc);
create index commercial_opportunities_goal_created_idx on public.commercial_opportunities(project_id, conversion_goal_id, created_at desc);
create index commercial_opportunities_entry_created_idx on public.commercial_opportunities(project_id, entry_point_id, created_at desc);
create index opportunity_timeline_opportunity_created_idx on public.opportunity_timeline(opportunity_id, created_at);

create trigger commercial_opportunities_set_updated_at before update on public.commercial_opportunities for each row execute function public.set_updated_at();

alter table public.commercial_opportunities enable row level security;
alter table public.opportunity_timeline enable row level security;
create policy "opportunities member all" on public.commercial_opportunities for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id) and public.project_workspace(project_id) = workspace_id);
create policy "opportunity timeline member all" on public.opportunity_timeline for all to authenticated
  using (exists(select 1 from public.commercial_opportunities o where o.id = opportunity_id and public.is_workspace_member(o.workspace_id)))
  with check (exists(select 1 from public.commercial_opportunities o where o.id = opportunity_id and public.is_workspace_member(o.workspace_id)));
