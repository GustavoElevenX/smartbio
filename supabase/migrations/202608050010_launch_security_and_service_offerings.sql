-- Segurança de lançamento e camada comercial genérica de serviços.
create table if not exists public.service_offerings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  short_description text,
  service_mode text not null default 'contact' check (service_mode in ('contact','quote','schedule','external_checkout','external_url')),
  price_mode text not null default 'on_request' check (price_mode in ('fixed','starting_at','range','on_request','free')),
  price numeric(14,2),
  min_price numeric(14,2),
  max_price numeric(14,2),
  currency text not null default 'BRL',
  image_asset_id uuid references public.media_assets(id) on delete set null,
  destination_id uuid references public.routing_destinations(id) on delete set null,
  external_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  service_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, slug),
  check (price is null or price >= 0),
  check (min_price is null or min_price >= 0),
  check (max_price is null or max_price >= 0),
  check (min_price is null or max_price is null or min_price <= max_price)
);

alter table public.schedulable_services add column if not exists service_offering_id uuid references public.service_offerings(id) on delete set null;

create table if not exists public.quote_questions (
  id uuid primary key default gen_random_uuid(),
  quote_definition_id uuid not null references public.quote_definitions(id) on delete cascade,
  field_key text not null,
  label text not null,
  description text,
  field_type text not null,
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  question_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  unique(quote_definition_id, field_key)
);

create index if not exists service_offerings_project_active_order_idx on public.service_offerings(project_id, is_active, service_order);
create index if not exists service_offerings_destination_idx on public.service_offerings(destination_id) where destination_id is not null;
create index if not exists service_offerings_image_idx on public.service_offerings(image_asset_id) where image_asset_id is not null;
create index if not exists schedulable_services_offering_idx on public.schedulable_services(service_offering_id) where service_offering_id is not null;
create index if not exists quote_questions_definition_order_idx on public.quote_questions(quote_definition_id, question_order);

drop trigger if exists service_offerings_set_updated_at on public.service_offerings;
create trigger service_offerings_set_updated_at before update on public.service_offerings for each row execute function public.set_updated_at();

alter table public.service_offerings enable row level security;
alter table public.quote_questions enable row level security;

drop policy if exists "service offerings member all" on public.service_offerings;
drop policy if exists "service offerings public" on public.service_offerings;
drop policy if exists "quote questions member all" on public.quote_questions;
drop policy if exists "quote questions public" on public.quote_questions;
create policy "service offerings member all" on public.service_offerings for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "service offerings public" on public.service_offerings for select to anon
  using (is_active and public.is_project_public(project_id));
create policy "quote questions member all" on public.quote_questions for all to authenticated
  using (public.is_workspace_member(public.project_workspace((select project_id from public.quote_definitions where id = quote_definition_id))))
  with check (public.is_workspace_member(public.project_workspace((select project_id from public.quote_definitions where id = quote_definition_id))));
create policy "quote questions public" on public.quote_questions for select to anon
  using (public.is_project_public((select project_id from public.quote_definitions where id = quote_definition_id)));

grant select, insert, update, delete on public.service_offerings, public.quote_questions to authenticated;
grant select on public.service_offerings, public.quote_questions to anon;
