-- Real account/workspace settings and invitations.
alter table public.profiles
  add column if not exists email text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_sign_in_at timestamptz,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended'));
create index if not exists profiles_email_idx on public.profiles(lower(email));
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

alter table public.workspaces
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended'));

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check(role in ('member')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index workspace_invitations_pending_email_idx on public.workspace_invitations(workspace_id,lower(email)) where status='pending';
alter table public.workspace_invitations enable row level security;
create policy "workspace invitations owner all" on public.workspace_invitations for all to authenticated
 using(public.is_workspace_owner(workspace_id)) with check(public.is_workspace_owner(workspace_id) and invited_by=auth.uid());
revoke all on public.workspace_invitations from anon;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare workspace_id uuid;
begin
  insert into public.profiles(id,full_name,avatar_url,email,last_sign_in_at)
  values(new.id,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'avatar_url',new.email,new.last_sign_in_at);
  insert into public.workspaces(name,slug,owner_id)
  values(coalesce(new.raw_user_meta_data->>'full_name','Meu workspace'), 'workspace-'||substr(replace(new.id::text,'-',''),1,12),new.id)
  returning id into workspace_id;
  insert into public.workspace_members(workspace_id,user_id,role) values(workspace_id,new.id,'owner');
  return new;
end $$;

comment on column public.workspaces.account_status is 'Operational status; does not delete or unpublish customer data.';
