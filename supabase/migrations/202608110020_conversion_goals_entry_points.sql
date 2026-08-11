create table public.conversion_goals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  goal_kind text not null check (goal_kind in ('buy','request_quote','schedule','reserve','contact','visit','learn','custom')),
  target_step_id uuid not null references public.journey_steps(id) on delete restrict,
  destination_label text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  goal_order integer not null default 0 check (goal_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, goal_order)
);

create unique index conversion_goals_one_primary_idx on public.conversion_goals(project_id) where is_primary and is_active;
create index conversion_goals_project_active_idx on public.conversion_goals(project_id, is_active, goal_order);
create index conversion_goals_target_step_idx on public.conversion_goals(target_step_id);

create table public.entry_points (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  entry_key text not null check (entry_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null,
  conversion_goal_id uuid references public.conversion_goals(id) on delete set null,
  target_step_id uuid references public.journey_steps(id) on delete set null,
  channel text not null default 'other' check (channel in ('bio','story','ad','qr','linkedin','other')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, entry_key),
  check (conversion_goal_id is not null or target_step_id is not null)
);

create index entry_points_project_active_idx on public.entry_points(project_id, is_active);
create index entry_points_goal_idx on public.entry_points(conversion_goal_id);
create index entry_points_target_step_idx on public.entry_points(target_step_id);

alter table public.step_options add column conversion_goal_id uuid references public.conversion_goals(id) on delete set null;
create index step_options_conversion_goal_idx on public.step_options(conversion_goal_id);

create trigger conversion_goals_set_updated_at before update on public.conversion_goals for each row execute function public.set_updated_at();
create trigger entry_points_set_updated_at before update on public.entry_points for each row execute function public.set_updated_at();

alter table public.conversion_goals enable row level security;
alter table public.entry_points enable row level security;

create policy "conversion goals member all" on public.conversion_goals for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "conversion goals public published" on public.conversion_goals for select to anon
  using (is_active and public.is_project_public(project_id));
create policy "entry points member all" on public.entry_points for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "entry points public published" on public.entry_points for select to anon
  using (is_active and public.is_project_public(project_id));
