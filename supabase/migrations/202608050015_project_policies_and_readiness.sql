-- Políticas editáveis e metadados de verificação usados pelo bloqueio de publicação.
create table if not exists public.project_policies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  policy_type text not null check (policy_type in ('privacy','cancellation','rescheduling','delivery','reservation','payment','custom')),
  title text not null,
  content text not null,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,policy_type)
);

alter table public.project_data_requirements add column if not exists field_metadata jsonb not null default '{}'::jsonb;
create index if not exists project_policies_project_active_idx on public.project_policies(project_id,is_active);
drop trigger if exists project_policies_set_updated_at on public.project_policies;
create trigger project_policies_set_updated_at before update on public.project_policies for each row execute function public.set_updated_at();

alter table public.project_policies enable row level security;
drop policy if exists "project policies member all" on public.project_policies;
drop policy if exists "project policies public" on public.project_policies;
create policy "project policies member all" on public.project_policies for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "project policies public" on public.project_policies for select to anon using (is_active and public.is_project_public(project_id));
grant select,insert,update,delete on public.project_policies to authenticated;
grant select on public.project_policies to anon;
