create table public.customer_identities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 phone_e164 text, phone_hash text, email_normalized text, email_hash text, external_customer_id text, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(phone_e164 is not null or email_normalized is not null or external_customer_id is not null)
);
create unique index customer_identities_project_phone_idx on public.customer_identities(project_id,phone_hash) where phone_hash is not null;
create unique index customer_identities_project_email_idx on public.customer_identities(project_id,email_hash) where email_hash is not null;
create table public.customer_identity_evidence (
 id uuid primary key default gen_random_uuid(), customer_identity_id uuid not null references public.customer_identities(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 evidence_type text not null check(evidence_type in ('first_seen','order_submitted','opportunity_converted','benefit_redeemed','historical_customer_import','external_customer','manual_confirmation')),
 source_type text, source_id text, occurred_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index customer_identity_evidence_customer_idx on public.customer_identity_evidence(customer_identity_id,evidence_type,occurred_at desc);
create unique index customer_identity_evidence_source_idx on public.customer_identity_evidence(customer_identity_id,evidence_type,source_type,source_id) where source_type is not null and source_id is not null;
alter table public.visitor_sessions add column customer_identity_id uuid references public.customer_identities(id) on delete set null;
alter table public.commercial_opportunities add column customer_identity_id uuid references public.customer_identities(id) on delete set null;
create index visitor_sessions_customer_identity_idx on public.visitor_sessions(project_id,customer_identity_id);
create index opportunities_customer_identity_idx on public.commercial_opportunities(project_id,customer_identity_id,created_at desc);
alter table public.business_sources add column if not exists source_purpose text not null default 'business_data';
alter table public.business_sources add constraint business_sources_source_purpose_check check(source_purpose in ('business_data','customer_history'));
create table public.customer_import_batches (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, project_id uuid not null references public.projects(id) on delete cascade,
 business_source_id uuid not null references public.business_sources(id) on delete cascade, phone_column text, email_column text, external_id_column text,
 status text not null default 'pending' check(status in ('pending','processing','completed','failed')), imported_count integer not null default 0, skipped_count integer not null default 0,
 created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.customer_identities enable row level security; alter table public.customer_identity_evidence enable row level security; alter table public.customer_import_batches enable row level security;
create policy "customer identities member all" on public.customer_identities for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
create policy "customer evidence member all" on public.customer_identity_evidence for all to authenticated using(exists(select 1 from public.customer_identities i where i.id=customer_identity_id and public.is_workspace_member(i.workspace_id))) with check(exists(select 1 from public.customer_identities i where i.id=customer_identity_id and public.is_workspace_member(i.workspace_id)));
create policy "customer imports member all" on public.customer_import_batches for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and public.project_workspace(project_id)=workspace_id);
revoke all on public.customer_identities, public.customer_identity_evidence, public.customer_import_batches from anon;
