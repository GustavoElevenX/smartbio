create table public.presence_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_key text not null check (page_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  name text not null,
  page_type text not null default 'page' check (page_type in ('home','landing','page')),
  path text not null default '/',
  title text,
  description text,
  seo_title text,
  seo_description text,
  og_image_asset_id uuid references public.media_assets(id) on delete set null,
  default_conversion_goal_id uuid references public.conversion_goals(id) on delete set null,
  is_home boolean not null default false,
  is_active boolean not null default true,
  is_indexable boolean not null default true,
  version integer not null default 1 check (version > 0),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, page_key),
  unique(project_id, path),
  check ((is_home and page_type = 'home' and path = '/') or not is_home)
);

create unique index presence_pages_single_home_idx on public.presence_pages(project_id) where is_home = true;
create index presence_pages_project_active_idx on public.presence_pages(project_id, is_active);
create index presence_pages_project_type_idx on public.presence_pages(project_id, page_type);

create table public.presence_sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.presence_pages(id) on delete cascade,
  section_key text not null,
  section_type text not null check (section_type in ('hero','rich_text','benefits','feature_grid','services','products','about','stats','logo_cloud','gallery','portfolio','testimonials','faq','pricing','locations','contact','video','conversion_cta','divider')),
  anchor text,
  title text,
  eyebrow text,
  description text,
  content jsonb not null default '{}'::jsonb,
  style jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  section_order integer not null default 0 check (section_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, section_key)
);

create index presence_sections_page_order_idx on public.presence_sections(page_id, section_order);
create trigger presence_pages_set_updated_at before update on public.presence_pages for each row execute function public.set_updated_at();
create trigger presence_sections_set_updated_at before update on public.presence_sections for each row execute function public.set_updated_at();

alter table public.presence_pages enable row level security;
alter table public.presence_sections enable row level security;

create policy "presence pages member all" on public.presence_pages for all to authenticated
  using (public.is_workspace_member(public.project_workspace(project_id)))
  with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "presence sections member all" on public.presence_sections for all to authenticated
  using (exists(select 1 from public.presence_pages p where p.id = page_id and public.is_workspace_member(public.project_workspace(p.project_id))))
  with check (exists(select 1 from public.presence_pages p where p.id = page_id and public.is_workspace_member(public.project_workspace(p.project_id))));

revoke all on public.presence_pages, public.presence_sections from anon;
