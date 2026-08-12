create table public.conversion_activations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade, activation_key text not null, name text not null, description text,
  activation_type text not null check (activation_type in ('promotion','launch','fill_calendar','lead_capture','product_push','service_push','location_push','waitlist','seasonal','announcement','custom')),
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','ended','archived')),
  conversion_goal_id uuid references public.conversion_goals(id) on delete set null, default_destination_id uuid references public.routing_destinations(id) on delete set null,
  title text, message text, starts_at timestamptz, ends_at timestamptz, timezone text not null default 'America/Sao_Paulo', priority integer not null default 0,
  requires_identity boolean not null default false, identity_mode text not null default 'phone' check (identity_mode in ('none','phone','email','phone_or_email')),
  completion_channel text check (completion_channel is null or completion_channel in ('native','whatsapp','external_url','email','phone')),
  eligibility jsonb not null default '{}'::jsonb, limits jsonb not null default '{}'::jsonb, settings jsonb not null default '{}'::jsonb,
  published_snapshot jsonb, published_at timestamptz, version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(project_id, activation_key), check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index conversion_activations_project_status_idx on public.conversion_activations(project_id,status,starts_at,ends_at);
create index conversion_activations_project_priority_idx on public.conversion_activations(project_id,priority desc,created_at desc);

create table public.activation_entry_points (activation_id uuid not null references public.conversion_activations(id) on delete cascade, entry_point_id uuid not null references public.entry_points(id) on delete cascade, primary key(activation_id,entry_point_id));
create table public.activation_locations (activation_id uuid not null references public.conversion_activations(id) on delete cascade, location_id uuid not null references public.business_locations(id) on delete cascade, primary key(activation_id,location_id));

create table public.activation_offers (
  id uuid primary key default gen_random_uuid(), activation_id uuid not null references public.conversion_activations(id) on delete cascade,
  offer_type text not null check (offer_type in ('percentage_discount','fixed_discount','free_shipping','special_price','free_item','bonus','coupon','no_discount')),
  label text not null, description text, percentage numeric(7,4), amount numeric(14,2), special_price numeric(14,2), currency text not null default 'BRL',
  min_subtotal numeric(14,2), max_discount numeric(14,2), scope jsonb not null default '{}'::jsonb, benefit_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (percentage is null or (percentage > 0 and percentage <= 100)), check(amount is null or amount >= 0), check(min_subtotal is null or min_subtotal >= 0), check(currency ~ '^[A-Z]{3}$')
);

create table public.activation_placements (
  id uuid primary key default gen_random_uuid(), activation_id uuid not null references public.conversion_activations(id) on delete cascade,
  presence_page_id uuid references public.presence_pages(id) on delete cascade, presence_section_id uuid references public.presence_sections(id) on delete set null,
  placement_type text not null check (placement_type in ('announcement_bar','hero_override','section_badge','product_badge','service_badge','conversion_cta','journey_banner','floating_cta')),
  content jsonb not null default '{}'::jsonb, style jsonb not null default '{}'::jsonb, priority integer not null default 0, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index activation_placements_activation_idx on public.activation_placements(activation_id,priority desc);

create trigger conversion_activations_updated_at before update on public.conversion_activations for each row execute function public.set_updated_at();
create trigger activation_offers_updated_at before update on public.activation_offers for each row execute function public.set_updated_at();
create trigger activation_placements_updated_at before update on public.activation_placements for each row execute function public.set_updated_at();

alter table public.conversion_activations enable row level security;
alter table public.activation_offers enable row level security;
alter table public.activation_placements enable row level security;
alter table public.activation_entry_points enable row level security;
alter table public.activation_locations enable row level security;
create policy "activations member all" on public.conversion_activations for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
create policy "activation offers member all" on public.activation_offers for all to authenticated using(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id))) with check(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id)));
create policy "activation placements member all" on public.activation_placements for all to authenticated using(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id))) with check(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id)));
create policy "activation entries member all" on public.activation_entry_points for all to authenticated using(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id))) with check(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id)));
create policy "activation locations member all" on public.activation_locations for all to authenticated using(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id))) with check(exists(select 1 from public.conversion_activations a where a.id=activation_id and public.is_workspace_member(a.workspace_id)));
revoke all on public.conversion_activations, public.activation_offers, public.activation_placements, public.activation_entry_points, public.activation_locations from anon;

alter table public.optimization_suggestions drop constraint if exists optimization_suggestions_suggestion_kind_check;
alter table public.optimization_suggestions add constraint optimization_suggestions_suggestion_kind_check check(suggestion_kind in ('goal_dropoff','entry_underperformance','destination_friction','journey_friction','presence_cta','presence_structure','landing_page','activation','offer','activation_placement'));
