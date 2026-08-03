-- Agenda nativa com idempotência e proteção transacional contra sobreposição.
create table public.schedulable_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 1440),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 1440),
  price numeric(14,2),
  currency text not null default 'BRL',
  confirmation_mode text not null default 'manual_approval' check (confirmation_mode in ('instant','manual_approval','external_system')),
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  resource_type text not null default 'professional',
  location_name text,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_resources (
  service_id uuid not null references public.schedulable_services(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  primary key(service_id, resource_id)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  timezone text not null default 'America/Sao_Paulo',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  is_active boolean not null default true,
  check (ends_at > starts_at)
);

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  resource_id uuid references public.resources(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_available boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  service_id uuid not null references public.schedulable_services(id) on delete restrict,
  resource_id uuid references public.resources(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancel_requested','cancelled','reschedule_requested','completed','no_show')),
  confirmation_mode text not null check (confirmation_mode in ('instant','manual_approval','external_system')),
  visitor_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, idempotency_key),
  check (ends_at > starts_at)
);

create table public.booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  request_type text not null check (request_type in ('cancel','reschedule')),
  requested_start timestamptz,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(booking_id, idempotency_key)
);

create index schedulable_services_project_active_idx on public.schedulable_services(project_id, is_active);
create index resources_project_active_idx on public.resources(project_id, is_active);
create index service_resources_resource_idx on public.service_resources(resource_id);
create index availability_rules_project_weekday_idx on public.availability_rules(project_id, weekday, is_active);
create index availability_rules_resource_idx on public.availability_rules(resource_id);
create index availability_exceptions_project_range_idx on public.availability_exceptions(project_id, starts_at, ends_at);
create index availability_exceptions_resource_idx on public.availability_exceptions(resource_id);
create index bookings_project_range_idx on public.bookings(project_id, starts_at, ends_at);
create index bookings_resource_range_idx on public.bookings(resource_id, starts_at, ends_at) where status in ('pending','confirmed','reschedule_requested');
create index bookings_service_idx on public.bookings(service_id);
create index bookings_lead_idx on public.bookings(lead_id) where lead_id is not null;
create index booking_changes_booking_created_idx on public.booking_change_requests(booking_id, created_at desc);

create trigger schedulable_services_set_updated_at before update on public.schedulable_services for each row execute function public.set_updated_at();
create trigger resources_set_updated_at before update on public.resources for each row execute function public.set_updated_at();
create trigger bookings_set_updated_at before update on public.bookings for each row execute function public.set_updated_at();

do $$ declare table_name text; begin
  foreach table_name in array array['schedulable_services','resources','service_resources','availability_rules','availability_exceptions','bookings','booking_change_requests'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "services member all" on public.schedulable_services for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "services public" on public.schedulable_services for select to anon using (is_active and public.is_project_public(project_id));
create policy "resources member all" on public.resources for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "resources public" on public.resources for select to anon using (is_active and public.is_project_public(project_id));
create policy "service resources member all" on public.service_resources for all to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.schedulable_services where id = service_id)))) with check (public.is_workspace_member(public.project_workspace((select project_id from public.schedulable_services where id = service_id))));
create policy "service resources public" on public.service_resources for select to anon using (public.is_project_public((select project_id from public.schedulable_services where id = service_id)));
create policy "availability rules member all" on public.availability_rules for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "availability rules public" on public.availability_rules for select to anon using (is_active and public.is_project_public(project_id));
create policy "availability exceptions member all" on public.availability_exceptions for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "bookings member read" on public.bookings for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "bookings member update" on public.bookings for update to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "booking changes member read" on public.booking_change_requests for select to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.bookings where id = booking_id))));

create or replace function public.create_booking_request(
  target_project uuid, request_session_key text, request_idempotency_key text,
  target_service uuid, target_resource uuid, requested_start timestamptz, requested_end timestamptz,
  requested_confirmation_mode text, requested_visitor_data jsonb
) returns public.bookings language plpgsql security definer set search_path = '' as $$
declare existing public.bookings; created public.bookings; effective_status text;
begin
  select * into existing from public.bookings where project_id = target_project and idempotency_key = request_idempotency_key;
  if found then return existing; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_project::text || ':' || coalesce(target_resource::text, target_service::text), 0));
  if exists (
    select 1 from public.bookings b
    where b.project_id = target_project and b.status in ('pending','confirmed','reschedule_requested')
      and (target_resource is null or b.resource_id = target_resource)
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(requested_start, requested_end, '[)')
  ) then raise exception 'booking_conflict' using errcode = 'P0001'; end if;
  effective_status := case when requested_confirmation_mode = 'instant' then 'confirmed' else 'pending' end;
  insert into public.bookings(project_id,session_key,idempotency_key,service_id,resource_id,starts_at,ends_at,status,confirmation_mode,visitor_data)
  values(target_project,request_session_key,request_idempotency_key,target_service,target_resource,requested_start,requested_end,effective_status,requested_confirmation_mode,coalesce(requested_visitor_data,'{}'::jsonb))
  returning * into created;
  return created;
end $$;

create or replace function public.request_booking_change(
  target_booking uuid, request_session_key text, request_idempotency_key text,
  request_type text, requested_start timestamptz, request_reason text
) returns public.booking_change_requests language plpgsql security definer set search_path = '' as $$
declare target public.bookings; existing public.booking_change_requests; created public.booking_change_requests;
begin
  select * into target from public.bookings where id = target_booking and session_key = request_session_key for update;
  if not found then raise exception 'booking_not_found' using errcode = 'P0002'; end if;
  select * into existing from public.booking_change_requests where booking_id = target_booking and idempotency_key = request_idempotency_key;
  if found then return existing; end if;
  insert into public.booking_change_requests(booking_id,session_key,idempotency_key,request_type,requested_start,reason)
  values(target_booking,request_session_key,request_idempotency_key,request_type,requested_start,request_reason) returning * into created;
  update public.bookings set status = case when request_type = 'cancel' then 'cancel_requested' else 'reschedule_requested' end where id = target_booking;
  return created;
end $$;

revoke all on public.bookings, public.booking_change_requests from anon, authenticated;
grant select, update on public.bookings to authenticated;
grant select on public.booking_change_requests to authenticated;
revoke all on function public.create_booking_request(uuid,text,text,uuid,uuid,timestamptz,timestamptz,text,jsonb) from public, anon, authenticated;
revoke all on function public.request_booking_change(uuid,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_booking_request(uuid,text,text,uuid,uuid,timestamptz,timestamptz,text,jsonb) to service_role;
grant execute on function public.request_booking_change(uuid,text,text,text,timestamptz,text) to service_role;
