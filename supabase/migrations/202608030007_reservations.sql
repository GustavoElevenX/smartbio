-- Reservas por capacidade com trava por unidade e intervalo semiaberto [entrada, saída).
create table public.reservable_units (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  capacity_adults integer not null check (capacity_adults > 0),
  capacity_children integer not null default 0 check (capacity_children >= 0),
  quantity integer not null default 1 check (quantity > 0),
  base_price numeric(14,2),
  currency text not null default 'BRL',
  is_active boolean not null default true,
  media_asset_ids uuid[] not null default '{}',
  amenities text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservation_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  unit_id uuid references public.reservable_units(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  quantity integer not null default 1 check (quantity > 0),
  reason text,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  unit_id uuid not null references public.reservable_units(id) on delete restrict,
  check_in date not null,
  check_out date not null,
  adults integer not null check (adults > 0),
  children integer not null default 0 check (children >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','cancel_requested','cancelled','completed','no_show')),
  total numeric(14,2),
  deposit_amount numeric(14,2),
  visitor_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, idempotency_key),
  check (check_out > check_in)
);

create table public.reservation_change_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  request_type text not null check (request_type in ('cancel','reschedule')),
  requested_check_in date,
  requested_check_out date,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique(reservation_id, idempotency_key)
);

create index reservable_units_project_active_idx on public.reservable_units(project_id, is_active);
create index reservation_blocks_project_range_idx on public.reservation_blocks(project_id, starts_on, ends_on);
create index reservation_blocks_unit_idx on public.reservation_blocks(unit_id);
create index reservations_project_created_idx on public.reservations(project_id, created_at desc);
create index reservations_unit_range_idx on public.reservations(unit_id, check_in, check_out) where status in ('pending','confirmed');
create index reservations_lead_idx on public.reservations(lead_id) where lead_id is not null;
create index reservation_changes_reservation_idx on public.reservation_change_requests(reservation_id, created_at desc);

create trigger reservable_units_set_updated_at before update on public.reservable_units for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations for each row execute function public.set_updated_at();

alter table public.reservable_units enable row level security;
alter table public.reservation_blocks enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_change_requests enable row level security;

create policy "units member all" on public.reservable_units for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "units public" on public.reservable_units for select to anon using (is_active and public.is_project_public(project_id));
create policy "reservation blocks member all" on public.reservation_blocks for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "reservations member read" on public.reservations for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "reservations member update" on public.reservations for update to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "reservation changes member read" on public.reservation_change_requests for select to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.reservations where id = reservation_id))));

create or replace function public.create_reservation_request(
  target_project uuid, request_session_key text, request_idempotency_key text,
  target_unit uuid, requested_check_in date, requested_check_out date,
  requested_adults integer, requested_children integer, requested_total numeric,
  requested_deposit numeric, requested_visitor_data jsonb
) returns public.reservations language plpgsql security definer set search_path = '' as $$
declare existing public.reservations; created public.reservations; target public.reservable_units; used_quantity integer; blocked_quantity integer;
begin
  select * into existing from public.reservations where project_id = target_project and idempotency_key = request_idempotency_key;
  if found then return existing; end if;
  select * into target from public.reservable_units where id = target_unit and project_id = target_project and is_active for update;
  if not found or target.capacity_adults < requested_adults or target.capacity_children < requested_children then raise exception 'unit_unavailable' using errcode = 'P0001'; end if;
  select count(*) into used_quantity from public.reservations r where r.unit_id = target_unit and r.status in ('pending','confirmed') and daterange(r.check_in,r.check_out,'[)') && daterange(requested_check_in,requested_check_out,'[)');
  select coalesce(sum(b.quantity),0) into blocked_quantity from public.reservation_blocks b where b.project_id = target_project and (b.unit_id is null or b.unit_id = target_unit) and daterange(b.starts_on,b.ends_on,'[)') && daterange(requested_check_in,requested_check_out,'[)');
  if used_quantity + blocked_quantity >= target.quantity then raise exception 'reservation_conflict' using errcode = 'P0001'; end if;
  insert into public.reservations(project_id,session_key,idempotency_key,unit_id,check_in,check_out,adults,children,status,total,deposit_amount,visitor_data)
  values(target_project,request_session_key,request_idempotency_key,target_unit,requested_check_in,requested_check_out,requested_adults,requested_children,'pending',requested_total,requested_deposit,coalesce(requested_visitor_data,'{}'::jsonb)) returning * into created;
  return created;
end $$;

create or replace function public.request_reservation_change(
  target_reservation uuid, request_session_key text, request_idempotency_key text,
  request_type text, requested_check_in date, requested_check_out date, request_reason text
) returns public.reservation_change_requests language plpgsql security definer set search_path = '' as $$
declare target public.reservations; existing public.reservation_change_requests; created public.reservation_change_requests;
begin
  select * into target from public.reservations where id = target_reservation and session_key = request_session_key for update;
  if not found then raise exception 'reservation_not_found' using errcode = 'P0002'; end if;
  select * into existing from public.reservation_change_requests where reservation_id = target_reservation and idempotency_key = request_idempotency_key;
  if found then return existing; end if;
  insert into public.reservation_change_requests(reservation_id,session_key,idempotency_key,request_type,requested_check_in,requested_check_out,reason)
  values(target_reservation,request_session_key,request_idempotency_key,request_type,requested_check_in,requested_check_out,request_reason) returning * into created;
  if request_type = 'cancel' then update public.reservations set status = 'cancel_requested' where id = target_reservation; end if;
  return created;
end $$;

revoke all on public.reservations, public.reservation_change_requests from anon, authenticated;
grant select, update on public.reservations to authenticated;
grant select on public.reservation_change_requests to authenticated;
revoke all on function public.create_reservation_request(uuid,text,text,uuid,date,date,integer,integer,numeric,numeric,jsonb) from public, anon, authenticated;
revoke all on function public.request_reservation_change(uuid,text,text,text,date,date,text) from public, anon, authenticated;
grant execute on function public.create_reservation_request(uuid,text,text,uuid,date,date,integer,integer,numeric,numeric,jsonb) to service_role;
grant execute on function public.request_reservation_change(uuid,text,text,text,date,date,text) to service_role;
