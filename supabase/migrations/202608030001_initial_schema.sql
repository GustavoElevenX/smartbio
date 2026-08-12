-- Virou MVP — schema, triggers, segurança e storage
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  primary_goal text,
  category text,
  theme jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  asset_type text not null check (asset_type in ('logo', 'favicon', 'image', 'video', 'background')),
  storage_path text not null,
  original_filename text,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm')),
  width integer,
  height integer,
  file_size bigint check (file_size is null or file_size >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  primary_logo_asset_id uuid references public.media_assets(id) on delete set null,
  light_logo_asset_id uuid references public.media_assets(id) on delete set null,
  dark_logo_asset_id uuid references public.media_assets(id) on delete set null,
  favicon_asset_id uuid references public.media_assets(id) on delete set null,
  extracted_colors jsonb not null default '[]'::jsonb,
  active_palette jsonb not null default '{}'::jsonb,
  palette_variations jsonb not null default '[]'::jsonb,
  design_system jsonb not null default '{}'::jsonb,
  brand_personality jsonb not null default '[]'::jsonb,
  analysis_metadata jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id, version_number)
);

create table public.journey_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('welcome', 'choice', 'form', 'content', 'recommendation', 'action', 'thank_you')),
  title text not null,
  description text,
  step_order integer not null check (step_order >= 0),
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, step_order)
);

create table public.design_overrides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id uuid references public.journey_steps(id) on delete cascade,
  block_key text,
  scope text not null check (scope in ('project', 'step', 'block')),
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'project' and step_id is null and block_key is null) or (scope = 'step' and step_id is not null and block_key is null) or (scope = 'block' and step_id is not null and block_key is not null))
);

create table public.step_options (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.journey_steps(id) on delete cascade,
  label text not null,
  description text,
  icon text,
  value text not null,
  option_order integer not null check (option_order >= 0),
  action_type text not null check (action_type in ('go_to_step', 'open_url', 'open_whatsapp', 'submit_form', 'show_recommendation', 'finish')),
  target_step_id uuid references public.journey_steps(id) on delete set null,
  action_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(step_id, option_order)
);

create table public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  step_id uuid references public.journey_steps(id) on delete cascade,
  name text not null,
  submit_label text not null default 'Continuar',
  success_message text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.form_definitions(id) on delete cascade,
  label text not null,
  field_key text not null,
  field_type text not null check (field_type in ('text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'date', 'url')),
  placeholder text,
  required boolean not null default false,
  field_order integer not null check (field_order >= 0),
  options jsonb not null default '[]'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(form_id, field_key),
  unique(form_id, field_order)
);

create table public.visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  visitor_id text not null,
  session_key text not null unique,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  device_type text,
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_step_id uuid references public.journey_steps(id) on delete set null
);

create table public.analytics_events (
  id bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.visitor_sessions(id) on delete cascade,
  event_name text not null check (event_name in ('page_view', 'session_started', 'step_viewed', 'option_clicked', 'form_started', 'form_submitted', 'recommendation_viewed', 'cta_clicked', 'whatsapp_clicked', 'external_link_clicked', 'journey_completed')),
  step_id uuid references public.journey_steps(id) on delete set null,
  option_id uuid references public.step_options(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  session_id uuid references public.visitor_sessions(id) on delete set null,
  name text,
  email text,
  phone text,
  company text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'lost')),
  source text,
  campaign text,
  recommendation text,
  answers jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('visitor', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free', 'pro', 'business')),
  status text not null default 'active',
  external_customer_id text,
  external_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

create index projects_workspace_idx on public.projects(workspace_id);
create index projects_public_slug_idx on public.projects(slug) where status = 'published';
create index media_assets_workspace_idx on public.media_assets(workspace_id, created_at desc);
create index journey_steps_project_order_idx on public.journey_steps(project_id, step_order);
create index step_options_step_order_idx on public.step_options(step_id, option_order);
create index analytics_events_project_created_idx on public.analytics_events(project_id, created_at desc);
create index analytics_events_event_name_idx on public.analytics_events(event_name);
create index visitor_sessions_project_started_idx on public.visitor_sessions(project_id, started_at desc);
create index leads_workspace_created_idx on public.leads(workspace_id, created_at desc);
create index leads_project_status_idx on public.leads(project_id, status);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','workspaces','projects','brand_profiles','journey_steps','design_overrides','step_options','form_definitions','form_fields','leads','chat_sessions','knowledge_entries','subscriptions']
  loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name); end loop;
end $$;

create or replace function public.is_workspace_member(target_workspace uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.workspace_members wm where wm.workspace_id = target_workspace and wm.user_id = auth.uid());
$$;

create or replace function public.is_workspace_owner(target_workspace uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.workspaces w where w.id = target_workspace and w.owner_id = auth.uid());
$$;

create or replace function public.project_workspace(target_project uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select workspace_id from public.projects where id = target_project;
$$;

create or replace function public.is_project_public(target_project uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.projects where id = target_project and status = 'published');
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.is_project_public(uuid) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects enable row level security;
alter table public.media_assets enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.project_versions enable row level security;
alter table public.journey_steps enable row level security;
alter table public.design_overrides enable row level security;
alter table public.step_options enable row level security;
alter table public.form_definitions enable row level security;
alter table public.form_fields enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.leads enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "workspaces select member" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "workspaces insert own" on public.workspaces for insert to authenticated with check (owner_id = auth.uid());
create policy "workspaces update owner" on public.workspaces for update to authenticated using (public.is_workspace_owner(id)) with check (owner_id = auth.uid());
create policy "workspaces delete owner" on public.workspaces for delete to authenticated using (public.is_workspace_owner(id));
create policy "members select member" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members insert owner" on public.workspace_members for insert to authenticated with check (public.is_workspace_owner(workspace_id));
create policy "members update owner" on public.workspace_members for update to authenticated using (public.is_workspace_owner(workspace_id)) with check (public.is_workspace_owner(workspace_id));
create policy "members delete owner" on public.workspace_members for delete to authenticated using (public.is_workspace_owner(workspace_id) and user_id <> auth.uid());
create policy "projects select member" on public.projects for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "projects select published" on public.projects for select to anon using (status = 'published');
create policy "projects insert member" on public.projects for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "projects update member" on public.projects for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "projects delete owner" on public.projects for delete to authenticated using (public.is_workspace_owner(workspace_id));
create policy "media member all" on public.media_assets for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and uploaded_by = auth.uid());
create policy "brand member all" on public.brand_profiles for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "brand public published" on public.brand_profiles for select to anon using (public.is_project_public(project_id));
create policy "versions member select" on public.project_versions for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "versions member insert" on public.project_versions for insert to authenticated with check (public.is_workspace_member(public.project_workspace(project_id)) and created_by = auth.uid());

create policy "steps member all" on public.journey_steps for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "steps public published" on public.journey_steps for select to anon using (public.is_project_public(project_id));
create policy "overrides member all" on public.design_overrides for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "overrides public published" on public.design_overrides for select to anon using (public.is_project_public(project_id));
create policy "options member all" on public.step_options for all to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.journey_steps where id = step_id)))) with check (public.is_workspace_member(public.project_workspace((select project_id from public.journey_steps where id = step_id))));
create policy "options public published" on public.step_options for select to anon using (public.is_project_public((select project_id from public.journey_steps where id = step_id)));
create policy "forms member all" on public.form_definitions for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "forms public published" on public.form_definitions for select to anon using (public.is_project_public(project_id));
create policy "fields member all" on public.form_fields for all to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.form_definitions where id = form_id)))) with check (public.is_workspace_member(public.project_workspace((select project_id from public.form_definitions where id = form_id))));
create policy "fields public published" on public.form_fields for select to anon using (public.is_project_public((select project_id from public.form_definitions where id = form_id)));

create policy "sessions member select" on public.visitor_sessions for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "events member select" on public.analytics_events for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "leads member select" on public.leads for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "leads member update" on public.leads for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id) and project_id in (select id from public.projects where workspace_id = leads.workspace_id));
create policy "chats member select" on public.chat_sessions for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "messages member select" on public.chat_messages for select to authenticated using (exists(select 1 from public.chat_sessions cs where cs.id = chat_session_id and public.is_workspace_member(public.project_workspace(cs.project_id))));
create policy "knowledge member all" on public.knowledge_entries for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "subscriptions member select" on public.subscriptions for select to authenticated using (public.is_workspace_member(workspace_id));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare new_workspace uuid; workspace_slug text;
begin
  insert into public.profiles(id, full_name, avatar_url) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'avatar_url');
  workspace_slug := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6);
  insert into public.workspaces(name, slug, owner_id) values (coalesce(new.raw_user_meta_data->>'full_name', 'Meu workspace'), workspace_slug, new.id) returning id into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace, new.id, 'owner');
  insert into public.subscriptions(workspace_id, plan_key, status) values (new_workspace, 'free', 'active');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml','video/mp4','video/webm'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "media public read" on storage.objects for select to anon, authenticated using (bucket_id = 'media');
create policy "media member upload" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media member update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "media member delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

revoke all on public.visitor_sessions, public.analytics_events, public.leads, public.chat_sessions, public.chat_messages from anon;
grant select on public.projects, public.brand_profiles, public.journey_steps, public.design_overrides, public.step_options, public.form_definitions, public.form_fields to anon;
