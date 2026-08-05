-- Unidades normalizadas e dados necessários para roteamento geográfico.
alter table public.routing_destinations add column if not exists settings jsonb not null default '{}'::jsonb;

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  address_line text,
  address_number text,
  address_extra text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  country_code text not null default 'BR',
  latitude double precision,
  longitude double precision,
  geocoding_status text not null default 'pending' check (geocoding_status in ('pending','resolved','manual','failed')),
  geocoding_provider text,
  geocoded_at timestamptz,
  phone text,
  whatsapp text,
  external_url text,
  timezone text not null default 'America/Sao_Paulo',
  opening_hours jsonb not null default '[]'::jsonb,
  service_radius_km numeric(8,2),
  delivery_radius_km numeric(8,2),
  supports_delivery boolean not null default false,
  supports_pickup boolean not null default false,
  supports_in_person boolean not null default true,
  priority integer not null default 0,
  is_active boolean not null default true,
  routing_destination_id uuid references public.routing_destinations(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check ((latitude is null) = (longitude is null)),
  check (service_radius_km is null or service_radius_km >= 0),
  check (delivery_radius_km is null or delivery_radius_km >= 0)
);

create index if not exists business_locations_project_active_idx on public.business_locations(project_id, is_active);
create index if not exists business_locations_city_idx on public.business_locations(project_id, city, neighborhood);
create index if not exists business_locations_destination_idx on public.business_locations(routing_destination_id) where routing_destination_id is not null;
drop trigger if exists business_locations_set_updated_at on public.business_locations;
create trigger business_locations_set_updated_at before update on public.business_locations for each row execute function public.set_updated_at();

alter table public.business_locations enable row level security;
drop policy if exists "business locations member all" on public.business_locations;
drop policy if exists "business locations public" on public.business_locations;
create policy "business locations member all" on public.business_locations for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "business locations public" on public.business_locations for select to anon
  using (is_active and public.is_project_public(project_id));
grant select, insert, update, delete on public.business_locations to authenticated;
grant select on public.business_locations to anon;
