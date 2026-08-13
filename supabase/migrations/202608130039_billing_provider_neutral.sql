-- Financial contract fields only. Authorization remains workspace_plan_assignments.
alter table public.subscriptions
 add column if not exists provider text,
 add column if not exists provider_price_id text,
 add column if not exists cancel_at_period_end boolean not null default false,
 add column if not exists cancelled_at timestamptz;
comment on table public.subscriptions is 'Provider-neutral financial contract. Never use directly for application authorization.';
