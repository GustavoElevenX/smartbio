-- Roteamento determinístico, integrações externas e trilha operacional.
create table public.routing_destinations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  channel text not null check (channel in ('whatsapp','url','email','phone','internal')),
  value text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routing_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  destination_id uuid not null references public.routing_destinations(id) on delete cascade,
  conditions jsonb not null default '[]'::jsonb,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_integrations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  integration_key text not null check (integration_key in ('whatsapp','external_payment','external_calendar','webhook')),
  enabled boolean not null default false,
  public_settings jsonb not null default '{}'::jsonb,
  secret_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, integration_key)
);

create table public.commercial_audit_log (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  object_type text not null,
  object_id uuid not null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index routing_destinations_project_active_idx on public.routing_destinations(project_id, is_active);
create index routing_rules_project_priority_idx on public.routing_rules(project_id, is_active, priority desc);
create index routing_rules_destination_idx on public.routing_rules(destination_id);
create index project_integrations_project_idx on public.project_integrations(project_id);
create index commercial_audit_project_created_idx on public.commercial_audit_log(project_id, created_at desc);
create index commercial_audit_object_idx on public.commercial_audit_log(object_type, object_id);
create index commercial_audit_workspace_idx on public.commercial_audit_log(workspace_id, created_at desc);

create trigger routing_destinations_set_updated_at before update on public.routing_destinations for each row execute function public.set_updated_at();
create trigger routing_rules_set_updated_at before update on public.routing_rules for each row execute function public.set_updated_at();
create trigger project_integrations_set_updated_at before update on public.project_integrations for each row execute function public.set_updated_at();

alter table public.routing_destinations enable row level security;
alter table public.routing_rules enable row level security;
alter table public.project_integrations enable row level security;
alter table public.commercial_audit_log enable row level security;

create policy "destinations member all" on public.routing_destinations for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "destinations public" on public.routing_destinations for select to anon using (is_active and public.is_project_public(project_id));
create policy "routing rules member all" on public.routing_rules for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "routing rules public" on public.routing_rules for select to anon using (is_active and public.is_project_public(project_id));
create policy "integrations member all" on public.project_integrations for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "audit member read" on public.commercial_audit_log for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.audit_commercial_status_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_workspace uuid;
begin
  if new.status is distinct from old.status then
    select workspace_id into target_workspace from public.projects where id = new.project_id;
    insert into public.commercial_audit_log(workspace_id,project_id,actor_id,object_type,object_id,action,before_state,after_state)
    values(target_workspace,new.project_id,auth.uid(),tg_table_name,new.id,'status_changed',jsonb_build_object('status',old.status),jsonb_build_object('status',new.status));
  end if;
  return new;
end $$;

create trigger quote_requests_audit after update of status on public.quote_requests for each row execute function public.audit_commercial_status_change();
create trigger bookings_audit after update of status on public.bookings for each row execute function public.audit_commercial_status_change();
create trigger order_requests_audit after update of status on public.order_requests for each row execute function public.audit_commercial_status_change();
create trigger reservations_audit after update of status on public.reservations for each row execute function public.audit_commercial_status_change();

revoke all on public.project_integrations, public.commercial_audit_log from anon;
revoke all on function public.audit_commercial_status_change() from public, anon, authenticated;
