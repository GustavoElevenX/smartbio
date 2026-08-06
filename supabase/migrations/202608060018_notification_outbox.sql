-- Outbox transacional para desacoplar operações públicas da entrega de e-mail.
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  event_key text not null,
  object_type text not null,
  object_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_key, object_type, object_id)
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox(status, available_at, created_at);
create index if not exists notification_outbox_workspace_status_idx
  on public.notification_outbox(workspace_id, status, created_at desc);

drop trigger if exists notification_outbox_set_updated_at on public.notification_outbox;
create trigger notification_outbox_set_updated_at before update on public.notification_outbox
for each row execute function public.set_updated_at();

alter table public.notification_outbox enable row level security;
drop policy if exists "notification outbox owner read" on public.notification_outbox;
create policy "notification outbox owner read" on public.notification_outbox for select to authenticated
  using (public.is_workspace_owner(workspace_id));
revoke insert,update,delete on public.notification_outbox from authenticated, anon;
grant select on public.notification_outbox to authenticated;

create or replace function public.claim_notification_outbox(
  p_worker_id text,
  p_limit integer default 25
) returns setof public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id_required';
  end if;
  return query
  with claimed as (
    select id
    from public.notification_outbox
    where status in ('pending','failed')
      and available_at <= now()
    order by available_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,25),100))
  )
  update public.notification_outbox outbox
  set status = 'processing',
      attempts = outbox.attempts + 1,
      locked_at = now(),
      locked_by = left(p_worker_id,120),
      last_error = null,
      updated_at = now()
  from claimed
  where outbox.id = claimed.id
  returning outbox.*;
end $$;

revoke all on function public.claim_notification_outbox(text,integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(text,integer) to service_role;
