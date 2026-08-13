-- Platform administration is separate from workspace membership. Support access is explicit and expiring.
create table public.platform_admins (
 user_id uuid primary key references public.profiles(id) on delete cascade,role text not null check(role in ('super_admin','support_admin')),
 is_active boolean not null default true,created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.platform_support_sessions (
 id uuid primary key default gen_random_uuid(),admin_user_id uuid not null references public.platform_admins(user_id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,project_id uuid references public.projects(id) on delete cascade,
 reason text not null check(length(trim(reason))>=5),status text not null default 'active' check(status in ('active','ended','expired','revoked')),
 started_at timestamptz not null default now(),expires_at timestamptz not null,ended_at timestamptz,created_at timestamptz not null default now(),
 check(expires_at>started_at and expires_at<=started_at+interval '60 minutes')
);
create table public.platform_support_grants (
 id uuid primary key default gen_random_uuid(),support_session_id uuid not null references public.platform_support_sessions(id) on delete cascade,
 admin_user_id uuid not null,workspace_id uuid not null,can_read boolean not null default true,can_write boolean not null default true,
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),unique(support_session_id,workspace_id)
);
create table public.platform_admin_audit_log (
 id bigint generated always as identity primary key,admin_user_id uuid not null,admin_role text not null,support_session_id uuid,
 workspace_id uuid,project_id uuid,action text not null,object_type text,object_id text,reason text,before_state jsonb,after_state jsonb,
 request_id text,created_at timestamptz not null default now()
);
create index platform_support_sessions_admin_idx on public.platform_support_sessions(admin_user_id,status,expires_at);
create index platform_support_sessions_workspace_idx on public.platform_support_sessions(workspace_id,status,expires_at);
create index platform_support_sessions_project_idx on public.platform_support_sessions(project_id,status,expires_at) where project_id is not null;
create index platform_support_grants_admin_active_idx on public.platform_support_grants(admin_user_id,workspace_id,expires_at) where revoked_at is null;
create index platform_admin_audit_workspace_idx on public.platform_admin_audit_log(workspace_id,created_at desc);
create trigger platform_admins_updated_at before update on public.platform_admins for each row execute function public.set_updated_at();

alter table public.platform_admins enable row level security; alter table public.platform_support_sessions enable row level security;
alter table public.platform_support_grants enable row level security; alter table public.platform_admin_audit_log enable row level security;
revoke all on public.platform_admins,public.platform_support_sessions,public.platform_support_grants,public.platform_admin_audit_log from anon,authenticated;

create or replace function public.has_active_platform_support_access(target_workspace uuid,permission text default 'read')
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.platform_support_grants g
  join public.platform_support_sessions s on s.id=g.support_session_id
  join public.platform_admins a on a.user_id=g.admin_user_id
  where g.admin_user_id=auth.uid() and g.workspace_id=target_workspace and a.is_active
    and s.status='active' and s.expires_at>now() and g.expires_at>now() and g.revoked_at is null
    and (permission='read' and g.can_read or permission='write' and g.can_write)
 );
$$;
grant execute on function public.has_active_platform_support_access(uuid,text) to authenticated;

create or replace function public.is_workspace_member(target_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspace_members wm where wm.workspace_id=target_workspace and wm.user_id=auth.uid())
   or public.has_active_platform_support_access(target_workspace,'read');
$$;

create or replace function public.start_platform_support_session(target_workspace uuid,target_project uuid,session_reason text,request_id text default null)
returns public.platform_support_sessions language plpgsql security definer set search_path='' as $$
declare admin_row public.platform_admins; result public.platform_support_sessions;
begin
 select * into admin_row from public.platform_admins where user_id=auth.uid() and is_active for update;
 if not found then raise exception 'platform_admin_required'; end if;
 if length(trim(session_reason))<5 then raise exception 'support_reason_required'; end if;
 if target_project is not null and public.project_workspace(target_project) is distinct from target_workspace then raise exception 'workspace_project_mismatch'; end if;
 insert into public.platform_support_sessions(admin_user_id,workspace_id,project_id,reason,expires_at)
 values(admin_row.user_id,target_workspace,target_project,trim(session_reason),now()+interval '60 minutes') returning * into result;
 insert into public.platform_support_grants(support_session_id,admin_user_id,workspace_id,expires_at)
 values(result.id,admin_row.user_id,target_workspace,result.expires_at);
 insert into public.platform_admin_audit_log(admin_user_id,admin_role,support_session_id,workspace_id,project_id,action,reason,request_id)
 values(admin_row.user_id,admin_row.role,result.id,target_workspace,target_project,'support.started',trim(session_reason),request_id);
 return result;
end $$;
revoke all on function public.start_platform_support_session(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.start_platform_support_session(uuid,uuid,text,text) to authenticated;

create or replace function public.end_platform_support_session(target_session uuid,request_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare current_session public.platform_support_sessions; v_admin_role text;
begin
 select s.* into current_session from public.platform_support_sessions s
  where s.id=target_session and s.admin_user_id=auth.uid() for update;
 if not found then raise exception 'support_session_not_found'; end if;
 select role into v_admin_role from public.platform_admins where user_id=current_session.admin_user_id and is_active;
 if not found then raise exception 'platform_admin_required'; end if;
 update public.platform_support_sessions set status='ended',ended_at=now() where id=target_session and status='active';
 update public.platform_support_grants set revoked_at=now() where support_session_id=target_session and revoked_at is null;
 insert into public.platform_admin_audit_log(admin_user_id,admin_role,support_session_id,workspace_id,project_id,action,reason,request_id)
 values(auth.uid(),v_admin_role,target_session,current_session.workspace_id,current_session.project_id,'support.ended',current_session.reason,request_id);
end $$;
revoke all on function public.end_platform_support_session(uuid,text) from public,anon,authenticated;
grant execute on function public.end_platform_support_session(uuid,text) to authenticated;
