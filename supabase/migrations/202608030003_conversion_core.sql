-- Camada de conversão: perfil do negócio, capacidades e novos blocos.
alter table public.journey_steps drop constraint if exists journey_steps_type_check;
alter table public.journey_steps add constraint journey_steps_type_check check (type in (
  'welcome','choice','form','content','recommendation','action','thank_you',
  'quote','catalog','cart','availability','schedule','reservation','routing','confirmation'
));

alter table public.step_options drop constraint if exists step_options_action_type_check;
alter table public.step_options add constraint step_options_action_type_check check (action_type in (
  'go_to_step','open_url','open_whatsapp','submit_form','show_recommendation','start_capability','finish'
));

alter table public.form_fields drop constraint if exists form_fields_field_type_check;
alter table public.form_fields add constraint form_fields_field_type_check check (field_type in (
  'text','email','phone','textarea','select','radio','checkbox','date','url','number','file','time'
));

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view','session_started','step_viewed','option_clicked','form_started','form_submitted',
  'recommendation_viewed','cta_clicked','whatsapp_clicked','external_link_clicked','journey_completed',
  'capability_started','qualification_completed','quote_started','quote_submitted','quote_estimate_viewed',
  'media_uploaded','availability_searched','slot_selected','booking_submitted','booking_confirmed','booking_cancel_requested',
  'catalog_viewed','item_viewed','item_added','cart_viewed','order_submitted','reservation_search_started',
  'reservation_option_viewed','reservation_submitted','reservation_confirmed','reservation_cancel_requested','route_resolved','payment_started'
));

alter table public.leads
  add column if not exists score integer,
  add column if not exists qualification_band text,
  add column if not exists qualification_reason text,
  add column if not exists commercial_action text,
  add column if not exists commercial_object_id uuid,
  add column if not exists operational_status text,
  add column if not exists estimated_value numeric(14,2),
  add column if not exists scheduled_at timestamptz,
  add column if not exists location_name text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists timeline jsonb not null default '[]'::jsonb;

create table public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  business_name text not null,
  description text not null default '',
  website_url text,
  category text,
  audience text,
  offer_kinds text[] not null default '{}',
  primary_intents text[] not null default '{}',
  confirmation_mode text not null default 'manual_approval' check (confirmation_mode in ('instant','manual_approval','external_system')),
  capacity_kinds text[] not null default '{}',
  completion_channel text not null default 'whatsapp' check (completion_channel in ('native','whatsapp','external_url','email','phone')),
  completion_destination text,
  whatsapp_phone text,
  signals jsonb not null default '{}'::jsonb,
  source text not null default 'rules' check (source in ('rules','ai','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_capabilities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  capability_key text not null check (capability_key in ('qualification','quote','scheduling','catalog_order','reservation','routing','external_payment')),
  enabled boolean not null default false,
  source text not null default 'suggested' check (source in ('suggested','user','ai')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, capability_key)
);

create table public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id uuid not null references public.journey_steps(id) on delete cascade,
  block_type text not null,
  block_order integer not null check (block_order >= 0),
  content jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(step_id, block_order)
);

create index business_profiles_project_idx on public.business_profiles(project_id);
create index project_capabilities_project_enabled_idx on public.project_capabilities(project_id, enabled);
create index content_blocks_step_order_idx on public.content_blocks(step_id, block_order);
create index leads_commercial_object_idx on public.leads(commercial_object_id) where commercial_object_id is not null;

create trigger business_profiles_set_updated_at before update on public.business_profiles for each row execute function public.set_updated_at();
create trigger project_capabilities_set_updated_at before update on public.project_capabilities for each row execute function public.set_updated_at();
create trigger content_blocks_set_updated_at before update on public.content_blocks for each row execute function public.set_updated_at();

alter table public.business_profiles enable row level security;
alter table public.project_capabilities enable row level security;
alter table public.content_blocks enable row level security;

create policy "business profiles member all" on public.business_profiles for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "business profiles public published" on public.business_profiles for select to anon
  using (public.is_project_public(project_id));
create policy "capabilities member all" on public.project_capabilities for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "capabilities public published" on public.project_capabilities for select to anon
  using (public.is_project_public(project_id));
create policy "blocks member all" on public.content_blocks for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "blocks public published" on public.content_blocks for select to anon
  using (public.is_project_public(project_id));

grant select on public.business_profiles, public.project_capabilities, public.content_blocks to anon;
