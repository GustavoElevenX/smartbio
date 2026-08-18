-- Stripe billing mirror, checkout idempotency and durable webhook processing.
alter table public.subscriptions drop constraint if exists subscriptions_plan_key_check;
alter table public.subscriptions
  add column if not exists pending_checkout_session_id text,
  add column if not exists pending_checkout_expires_at timestamptz,
  add column if not exists checkout_attempt_key text,
  add column if not exists latest_invoice_id text,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists provider_updated_at timestamptz;

-- Historical non-financial rows must not masquerade as paid contracts.
delete from public.subscriptions
where plan_key in ('free', 'business')
  and external_customer_id is null
  and external_subscription_id is null;
update public.subscriptions set plan_key = 'pro'
where plan_key <> 'pro';
alter table public.subscriptions
  add constraint subscriptions_plan_key_check check (plan_key = 'pro');

create unique index if not exists subscriptions_provider_customer_uidx
  on public.subscriptions(provider, external_customer_id)
  where external_customer_id is not null;
create unique index if not exists subscriptions_provider_subscription_uidx
  on public.subscriptions(provider, external_subscription_id)
  where external_subscription_id is not null;
create index if not exists subscriptions_pending_checkout_idx
  on public.subscriptions(pending_checkout_expires_at)
  where pending_checkout_session_id is not null;

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  provider_created_at timestamptz not null,
  processing_status text not null default 'processing'
    check (processing_status in ('processing','processed','failed')),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
create index if not exists billing_webhook_events_status_idx
  on public.billing_webhook_events(processing_status, processing_started_at);
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from anon, authenticated;

create or replace function public.claim_billing_webhook_event(
  event_provider text,
  event_provider_id text,
  event_name text,
  event_created_at timestamptz
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  started_at timestamptz;
  inserted_count integer;
begin
  insert into public.billing_webhook_events(
    provider,provider_event_id,event_type,provider_created_at
  ) values (event_provider,event_provider_id,event_name,event_created_at)
  on conflict(provider,provider_event_id) do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count = 1 then return 'claimed'; end if;

  select processing_status,processing_started_at
    into current_status,started_at
  from public.billing_webhook_events
  where provider=event_provider and provider_event_id=event_provider_id
  for update;

  if current_status='processed' then return 'duplicate'; end if;
  if current_status='processing' and started_at < now() - interval '5 minutes' then
    update public.billing_webhook_events set
      processing_started_at=now(),error=null,updated_at=now()
    where provider=event_provider and provider_event_id=event_provider_id;
    return 'claimed';
  end if;
  if current_status='processing' and started_at >= now() - interval '5 minutes'
    then return 'busy'; end if;
  if current_status='failed' then
    update public.billing_webhook_events set
      processing_status='processing',processing_started_at=now(),error=null,updated_at=now()
    where provider=event_provider and provider_event_id=event_provider_id;
  end if;
  return 'claimed';
end $$;
revoke all on function public.claim_billing_webhook_event(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_event(text,text,text,timestamptz) to service_role;

comment on table public.billing_webhook_events is
  'Idempotency ledger for cryptographically verified billing webhooks.';
comment on table public.subscriptions is
  'Stripe-backed financial contract mirror. Never use directly for feature authorization.';
