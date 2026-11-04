create table public.visual_design_kits (
  project_id uuid primary key references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kit_json jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  unique(workspace_id,project_id)
);

create table public.visual_artworks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  group_id uuid not null,
  spec_json jsonb not null,
  kit_json jsonb not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','approved')),
  output_asset_id uuid references public.media_assets(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,project_id,id)
);
create index visual_artworks_project_updated on public.visual_artworks(workspace_id,project_id,updated_at desc);
create index visual_artworks_group on public.visual_artworks(group_id);

create table public.visual_ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  artwork_id uuid not null references public.visual_artworks(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  provider text not null default 'cloudflare',
  created_at timestamptz not null default now()
);
create index visual_ai_usage_daily on public.visual_ai_usage(created_at desc);

create or replace function public.reserve_visual_image(p_workspace_id uuid,p_project_id uuid,p_artwork_id uuid,p_user_id uuid,p_workspace_cap integer,p_global_cap integer,p_artwork_cap integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  if not public.is_workspace_member(p_workspace_id) and auth.role() <> 'service_role' then raise exception 'visual_access_denied'; end if;
  if public.project_workspace(p_project_id) <> p_workspace_id or not exists (select 1 from public.visual_artworks where id=p_artwork_id and project_id=p_project_id and workspace_id=p_workspace_id) then raise exception 'visual_scope_invalid'; end if;
  perform pg_advisory_xact_lock(hashtext('content-image-global'));
  if (select (select count(*) from public.visual_ai_usage where created_at>=v_start) + (select count(*) from public.content_ai_usage where kind='image' and created_at>=v_start)) >= p_global_cap then raise exception 'visual_global_quota'; end if;
  if (select (select count(*) from public.visual_ai_usage where workspace_id=p_workspace_id and created_at>=v_start) + (select count(*) from public.content_ai_usage where kind='image' and workspace_id=p_workspace_id and created_at>=v_start)) >= p_workspace_cap then raise exception 'visual_workspace_quota'; end if;
  if (select count(*) from public.visual_ai_usage where artwork_id=p_artwork_id) >= p_artwork_cap then raise exception 'visual_artwork_quota'; end if;
  insert into public.visual_ai_usage(workspace_id,project_id,artwork_id,user_id) values(p_workspace_id,p_project_id,p_artwork_id,p_user_id) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_visual_image(uuid,uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_visual_image(uuid,uuid,uuid,uuid,integer,integer,integer) to service_role;

-- Keep the existing content studio and this visual engine under one shared daily cap.
create or replace function public.reserve_content_image(p_workspace_id uuid,p_project_id uuid,p_post_id uuid,p_user_id uuid,p_workspace_cap integer,p_global_cap integer,p_post_cap integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(hashtext('content-image-global'));
  if not exists(select 1 from public.content_posts where id=p_post_id and project_id=p_project_id and workspace_id=p_workspace_id) then raise exception 'post_scope_invalid'; end if;
  if (select (select count(*) from public.visual_ai_usage where created_at>=v_start) + (select count(*) from public.content_ai_usage where kind='image' and created_at>=v_start)) >= p_global_cap then raise exception 'content_global_quota'; end if;
  if (select (select count(*) from public.visual_ai_usage where workspace_id=p_workspace_id and created_at>=v_start) + (select count(*) from public.content_ai_usage where kind='image' and workspace_id=p_workspace_id and created_at>=v_start)) >= p_workspace_cap then raise exception 'content_workspace_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and user_id=p_user_id and created_at>=v_start) >= p_workspace_cap then raise exception 'content_user_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and post_id=p_post_id) >= p_post_cap then raise exception 'content_post_quota'; end if;
  insert into public.content_ai_usage(workspace_id,project_id,post_id,user_id,provider,kind,status) values(p_workspace_id,p_project_id,p_post_id,p_user_id,'cloudflare','image','reserved') returning id into v_id;
  return v_id;
end $$;

do $$ declare t text; begin
  foreach t in array array['visual_design_kits','visual_artworks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id)',t||'_read',t);
  end loop;
  alter table public.visual_ai_usage enable row level security;
  create policy visual_ai_usage_read on public.visual_ai_usage for select to authenticated using (public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
end $$;
