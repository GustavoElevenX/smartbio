-- P0-05: the public client requests a slot; the database derives and validates the booking.

create unique index if not exists schedulable_services_id_project_idx
  on public.schedulable_services(id, project_id);
create unique index if not exists resources_id_project_idx
  on public.resources(id, project_id);

alter table public.bookings
  add constraint bookings_service_project_fkey
  foreign key (service_id, project_id)
  references public.schedulable_services(id, project_id)
  on delete restrict;

alter table public.bookings
  add constraint bookings_resource_project_fkey
  foreign key (resource_id, project_id)
  references public.resources(id, project_id)
  on delete restrict;

drop function if exists public.create_booking_request(
  uuid, text, text, uuid, uuid, timestamptz, timestamptz, text, jsonb
);

create or replace function public.create_booking_request(
  target_project uuid,
  request_session_key text,
  request_idempotency_key text,
  target_service uuid,
  target_resource uuid,
  requested_start timestamptz,
  requested_visitor_data jsonb
) returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  service_row public.schedulable_services;
  resource_row public.resources;
  existing public.bookings;
  created public.bookings;
  expected_end timestamptz;
  occupied_start timestamptz;
  occupied_end timestamptz;
  effective_status text;
  has_resource_binding boolean;
begin
  if not public.is_project_public(target_project) then
    raise exception 'service_not_found' using errcode = 'P0002';
  end if;

  select service.*
    into service_row
    from public.schedulable_services service
   where service.id = target_service
     and service.project_id = target_project
     and service.is_active;
  if not found then
    raise exception 'service_not_found' using errcode = 'P0002';
  end if;

  select exists(
    select 1
      from public.service_resources binding
     where binding.service_id = target_service
  ) into has_resource_binding;

  if target_resource is not null then
    select resource.*
      into resource_row
      from public.resources resource
     where resource.id = target_resource
       and resource.project_id = target_project
       and resource.is_active;
    if not found then
      raise exception 'resource_not_found' using errcode = 'P0003';
    end if;
    if has_resource_binding and not exists(
      select 1
        from public.service_resources binding
       where binding.service_id = target_service
         and binding.resource_id = target_resource
    ) then
      raise exception 'resource_not_bound_to_service' using errcode = 'P0003';
    end if;
  elsif has_resource_binding then
    raise exception 'resource_required' using errcode = 'P0003';
  end if;

  expected_end := requested_start + make_interval(mins => service_row.duration_minutes);
  occupied_start := requested_start - make_interval(mins => service_row.buffer_before_minutes);
  occupied_end := expected_end + make_interval(mins => service_row.buffer_after_minutes);
  if requested_start <= statement_timestamp() or expected_end <= requested_start then
    raise exception 'invalid_booking_time' using errcode = 'P0004';
  end if;

  if not exists(
    select 1
      from public.availability_rules availability
     where availability.project_id = target_project
       and availability.is_active
       and (availability.resource_id is null or availability.resource_id = target_resource)
       and extract(dow from (requested_start at time zone availability.timezone))::integer = availability.weekday
       and (occupied_start at time zone availability.timezone)::date = (requested_start at time zone availability.timezone)::date
       and (occupied_end at time zone availability.timezone)::date = (requested_start at time zone availability.timezone)::date
       and (occupied_start at time zone availability.timezone)::time >= availability.starts_at
       and (occupied_end at time zone availability.timezone)::time <= availability.ends_at
       and mod(
         (extract(epoch from (((occupied_start at time zone availability.timezone)::time - availability.starts_at))) / 60)::integer,
         availability.slot_interval_minutes
       ) = 0
  ) then
    raise exception 'slot_outside_availability' using errcode = 'P0004';
  end if;

  if exists(
    select 1
      from public.availability_exceptions blocked
     where blocked.project_id = target_project
       and not blocked.is_available
       and (blocked.resource_id is null or blocked.resource_id = target_resource)
       and tstzrange(blocked.starts_at, blocked.ends_at, '[)')
         && tstzrange(requested_start, expected_end, '[)')
  ) then
    raise exception 'slot_blocked' using errcode = 'P0004';
  end if;

  -- Every request follows the same lock order. The idempotency lock prevents a
  -- duplicate key race; service/resource locks make the final conflict check atomic.
  perform pg_advisory_xact_lock(hashtextextended(target_project::text || ':booking:' || request_idempotency_key, 0));
  perform pg_advisory_xact_lock(hashtextextended(target_project::text || ':service:' || target_service::text, 0));
  if target_resource is not null then
    perform pg_advisory_xact_lock(hashtextextended(target_project::text || ':resource:' || target_resource::text, 0));
  end if;

  select booking.*
    into existing
    from public.bookings booking
   where booking.project_id = target_project
     and booking.idempotency_key = request_idempotency_key;
  if found then
    if existing.session_key <> request_session_key
      or existing.service_id <> target_service
      or existing.resource_id is distinct from target_resource
      or existing.starts_at <> requested_start then
      raise exception 'idempotency_conflict' using errcode = 'P0005';
    end if;
    return existing;
  end if;

  if exists(
    select 1
      from public.bookings booking
      join public.schedulable_services booked_service on booked_service.id = booking.service_id
     where booking.project_id = target_project
       and booking.status in ('pending', 'confirmed', 'reschedule_requested')
       and (
         (target_resource is not null and (
           booking.resource_id = target_resource
           or (booking.resource_id is null and booking.service_id = target_service)
         ))
         or (target_resource is null and booking.service_id = target_service)
       )
       and tstzrange(
         booking.starts_at - make_interval(mins => booked_service.buffer_before_minutes),
         booking.ends_at + make_interval(mins => booked_service.buffer_after_minutes),
         '[)'
       ) && tstzrange(occupied_start, occupied_end, '[)')
  ) then
    raise exception 'booking_conflict' using errcode = 'P0001';
  end if;

  effective_status := case
    when service_row.confirmation_mode = 'instant' then 'confirmed'
    else 'pending'
  end;

  insert into public.bookings(
    project_id,
    session_key,
    idempotency_key,
    service_id,
    resource_id,
    starts_at,
    ends_at,
    status,
    confirmation_mode,
    visitor_data
  ) values (
    target_project,
    request_session_key,
    request_idempotency_key,
    target_service,
    target_resource,
    requested_start,
    expected_end,
    effective_status,
    service_row.confirmation_mode,
    coalesce(requested_visitor_data, '{}'::jsonb)
  ) returning * into created;

  return created;
end;
$$;

revoke all on function public.create_booking_request(
  uuid, text, text, uuid, uuid, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.create_booking_request(
  uuid, text, text, uuid, uuid, timestamptz, jsonb
) to service_role;
