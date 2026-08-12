create table public.redemption_validators (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 location_id uuid references public.business_locations(id) on delete cascade, name text not null, token_hash text not null unique, is_active boolean not null default true,
 last_used_at timestamptz, created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), revoked_at timestamptz
);
create table public.benefit_claims (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 activation_id uuid not null references public.conversion_activations(id) on delete cascade, offer_id uuid references public.activation_offers(id) on delete set null,
 customer_identity_id uuid not null references public.customer_identities(id) on delete cascade, visitor_session_id uuid references public.visitor_sessions(id) on delete set null,
 opportunity_id uuid references public.commercial_opportunities(id) on delete set null, code text not null,
 status text not null default 'issued' check(status in ('issued','presented','redeemed','expired','cancelled')), issued_at timestamptz not null default now(), expires_at timestamptz,
 presented_at timestamptz, redeemed_at timestamptz, cancelled_at timestamptz, eligibility_snapshot jsonb not null default '{}'::jsonb,
 benefit_snapshot jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(project_id,code)
);
create index benefit_claims_activation_created_idx on public.benefit_claims(project_id,activation_id,created_at desc);
create index benefit_claims_customer_activation_idx on public.benefit_claims(customer_identity_id,activation_id,status,expires_at);
create table public.benefit_redemptions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 claim_id uuid not null unique references public.benefit_claims(id) on delete restrict, activation_id uuid not null references public.conversion_activations(id) on delete restrict,
 offer_id uuid references public.activation_offers(id) on delete set null, customer_identity_id uuid not null references public.customer_identities(id) on delete restrict,
 opportunity_id uuid references public.commercial_opportunities(id) on delete set null, location_id uuid references public.business_locations(id) on delete set null,
 order_request_id uuid references public.order_requests(id) on delete set null, subtotal_before numeric(14,2), discount_amount numeric(14,2), delivery_discount numeric(14,2), final_amount numeric(14,2),
 currency text not null default 'BRL', redemption_mode text not null check(redemption_mode in ('human_validator','native_order','external_confirmation','manual_dashboard')),
 redeemed_by_user_id uuid references public.profiles(id) on delete set null, validator_id uuid references public.redemption_validators(id) on delete set null,
 metadata jsonb not null default '{}'::jsonb, redeemed_at timestamptz not null default now(), created_at timestamptz not null default now(), check(currency ~ '^[A-Z]{3}$')
);
create index benefit_redemptions_activation_idx on public.benefit_redemptions(project_id,activation_id,redeemed_at desc);
create index benefit_redemptions_location_idx on public.benefit_redemptions(project_id,location_id,redeemed_at desc);
create trigger benefit_claims_updated_at before update on public.benefit_claims for each row execute function public.set_updated_at();
alter table public.redemption_validators enable row level security; alter table public.benefit_claims enable row level security; alter table public.benefit_redemptions enable row level security;
create policy "validators member all" on public.redemption_validators for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
create policy "benefit claims member all" on public.benefit_claims for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
create policy "benefit redemptions member all" on public.benefit_redemptions for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
revoke all on public.redemption_validators, public.benefit_claims, public.benefit_redemptions from anon;
