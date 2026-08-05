-- Central de notificações in-app e entregas por e-mail.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  event_key text not null,
  title text not null,
  body text not null,
  action_url text,
  object_type text,
  object_id text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,user_id,event_key)
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('in_app','email')),
  status text not null check (status in ('pending','sent','failed','skipped')),
  provider text,
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,channel)
);

drop index if exists public.notifications_event_object_unique_idx;
create unique index notifications_event_object_unique_idx on public.notifications(workspace_id,event_key,object_type,object_id,coalesce(user_id,'00000000-0000-0000-0000-000000000000'::uuid)) where object_type is not null and object_id is not null;
create index if not exists notifications_user_unread_idx on public.notifications(user_id,read_at,created_at desc);
create index if not exists notifications_workspace_created_idx on public.notifications(workspace_id,created_at desc);
create index if not exists notification_deliveries_status_idx on public.notification_deliveries(status,created_at);
create index if not exists notification_deliveries_notification_idx on public.notification_deliveries(notification_id);

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();
drop trigger if exists notification_deliveries_set_updated_at on public.notification_deliveries;
create trigger notification_deliveries_set_updated_at before update on public.notification_deliveries for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;
drop policy if exists "notifications recipient read" on public.notifications;
drop policy if exists "notifications recipient update" on public.notifications;
drop policy if exists "notification preferences own all" on public.notification_preferences;
drop policy if exists "notification deliveries recipient read" on public.notification_deliveries;
create policy "notifications recipient read" on public.notifications for select to authenticated using (public.is_workspace_member(workspace_id) and (user_id is null or user_id = (select auth.uid())));
create policy "notifications recipient update" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy "notification preferences own all" on public.notification_preferences for all to authenticated using (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id)) with check (user_id = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy "notification deliveries recipient read" on public.notification_deliveries for select to authenticated using (exists(select 1 from public.notifications n where n.id = notification_id and public.is_workspace_member(n.workspace_id) and (n.user_id is null or n.user_id = (select auth.uid()))));

revoke insert,update,delete on public.notifications,public.notification_deliveries from authenticated;
grant select,update(read_at) on public.notifications to authenticated;
grant select,insert,update,delete on public.notification_preferences to authenticated;
grant select on public.notification_deliveries to authenticated;
