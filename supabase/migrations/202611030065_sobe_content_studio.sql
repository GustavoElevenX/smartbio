-- SOBE Conteúdo: dados privados por projeto; funções de reserva/claim executadas apenas pelo servidor.
create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','publishing','published','failed','cancelled')),
  objective text not null,
  format text not null default 'carousel' check (format in ('carousel','single')),
  brief_json jsonb not null,
  plan_json jsonb not null,
  slides_json jsonb not null default '[]',
  caption text not null default '',
  current_version integer not null default 1 check (current_version > 0),
  approved_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, workspace_id, project_id),
  check (approved_version is null or approved_version <= current_version)
);
create index content_posts_project_idx on public.content_posts(workspace_id,project_id,updated_at desc);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  post_id uuid not null,
  slide_id text,
  origin text not null check (origin in ('ai_generated','rendered')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png')),
  byte_size integer not null check (byte_size > 0),
  created_at timestamptz not null default now(),
  foreign key (post_id,workspace_id,project_id) references public.content_posts(id,workspace_id,project_id) on delete cascade
);
create index content_assets_post_idx on public.content_assets(workspace_id,project_id,post_id);

create table public.content_ai_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  post_id uuid references public.content_posts(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null,
  kind text not null check (kind in ('image','copy')),
  status text not null check (status in ('reserved','completed','failed')),
  request_id text,
  estimated_units numeric,
  created_at timestamptz not null default now()
);
create index content_ai_usage_daily_idx on public.content_ai_usage(workspace_id,created_at desc) where kind='image';

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  provider text not null default 'instagram' check (provider='instagram'),
  composio_user_id text not null,
  connection_request_id text,
  connected_account_id text,
  display_name text,
  status text not null default 'pending' check (status in ('pending','active','disconnected','failed')),
  initiated_by uuid references public.profiles(id) on delete set null,
  nonce_hash text,
  nonce_expires_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,project_id,provider),
  unique(id,workspace_id,project_id)
);

create table public.social_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  post_id uuid not null,
  connection_id uuid not null,
  approved_by uuid references public.profiles(id) on delete set null,
  snapshot_json jsonb not null,
  snapshot_version integer not null,
  scheduled_at_utc timestamptz,
  status text not null default 'queued' check (status in ('queued','in_progress','published','failed','needs_review','cancelled')),
  idempotency_key text not null,
  external_creation_id text,
  external_media_id text,
  external_permalink text,
  lease_owner text,
  lease_until timestamptz,
  attempts integer not null default 0,
  last_error_code text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (post_id,workspace_id,project_id) references public.content_posts(id,workspace_id,project_id) on delete cascade,
  foreign key (connection_id,workspace_id,project_id) references public.social_connections(id,workspace_id,project_id),
  unique(workspace_id,idempotency_key)
);
create index social_publications_queue_idx on public.social_publications(status,scheduled_at_utc) where status='queued';
create unique index social_publications_active_version_idx on public.social_publications(post_id,snapshot_version,connection_id) where status in ('queued','in_progress','published','needs_review');

create or replace function public.reserve_content_image(p_workspace_id uuid,p_project_id uuid,p_post_id uuid,p_user_id uuid,p_workspace_cap integer,p_global_cap integer,p_post_cap integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(hashtext('content-image-global'));
  if not exists(select 1 from public.content_posts where id=p_post_id and project_id=p_project_id and workspace_id=p_workspace_id) then raise exception 'post_scope_invalid'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and status in ('reserved','completed','failed') and created_at>=v_start) >= p_global_cap then raise exception 'content_global_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and status in ('reserved','completed','failed') and workspace_id=p_workspace_id and created_at>=v_start) >= p_workspace_cap then raise exception 'content_workspace_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and status in ('reserved','completed','failed') and user_id=p_user_id and created_at>=v_start) >= p_workspace_cap then raise exception 'content_user_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='image' and status in ('reserved','completed','failed') and post_id=p_post_id) >= p_post_cap then raise exception 'content_post_quota'; end if;
  insert into public.content_ai_usage(workspace_id,project_id,post_id,user_id,provider,kind,status) values(p_workspace_id,p_project_id,p_post_id,p_user_id,'cloudflare','image','reserved') returning id into v_id;
  return v_id;
end $$;

create or replace function public.reserve_content_copy(p_workspace_id uuid,p_project_id uuid,p_user_id uuid,p_workspace_month_cap integer,p_global_month_cap integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_start timestamptz := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
  perform pg_advisory_xact_lock(hashtext('content-copy-global'));
  if not exists(select 1 from public.projects where id=p_project_id and workspace_id=p_workspace_id) then raise exception 'project_scope_invalid'; end if;
  if (select count(*) from public.content_ai_usage where kind='copy' and created_at>=v_start) >= p_global_month_cap then raise exception 'content_copy_global_quota'; end if;
  if (select count(*) from public.content_ai_usage where kind='copy' and workspace_id=p_workspace_id and created_at>=v_start) >= p_workspace_month_cap then raise exception 'content_copy_workspace_quota'; end if;
  insert into public.content_ai_usage(workspace_id,project_id,user_id,provider,kind,status) values(p_workspace_id,p_project_id,p_user_id,'openai','copy','reserved') returning id into v_id;
  return v_id;
end $$;

create or replace function public.claim_social_publications(p_worker text,p_limit integer,p_publication_id uuid default null)
returns setof public.social_publications language plpgsql security definer set search_path=public as $$
begin
  update public.social_publications set status='needs_review',last_error_code='lease_expired',lease_owner=null,lease_until=null,updated_at=now() where status='in_progress' and lease_until<now();
  return query update public.social_publications sp set status='in_progress', lease_owner=p_worker, lease_until=now()+interval '4 minutes', attempts=attempts+1,updated_at=now()
  where sp.id in (select id from public.social_publications where status='queued' and scheduled_at_utc<=now() and (p_publication_id is null or id=p_publication_id) order by scheduled_at_utc for update skip locked limit least(greatest(p_limit,1),10))
  returning sp.*;
end $$;
revoke all on function public.reserve_content_image(uuid,uuid,uuid,uuid,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.reserve_content_copy(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.claim_social_publications(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.reserve_content_image(uuid,uuid,uuid,uuid,integer,integer,integer) to service_role;
grant execute on function public.reserve_content_copy(uuid,uuid,uuid,integer,integer) to service_role;
grant execute on function public.claim_social_publications(text,integer,uuid) to service_role;

do $$ declare t text; begin
  foreach t in array array['content_posts','content_assets','content_ai_usage','social_connections','social_publications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id)',t||'_read',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id) with check (public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id)',t||'_write',t);
  end loop;
end $$;

\n