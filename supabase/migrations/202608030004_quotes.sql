-- Orçamentos nativos e anexos privados.
create table public.quote_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  name text not null,
  currency text not null default 'BRL',
  base_price numeric(14,2),
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_rules (
  id uuid primary key default gen_random_uuid(),
  quote_definition_id uuid not null references public.quote_definitions(id) on delete cascade,
  field_key text not null,
  operator text not null check (operator in ('equals','not_equals','contains','greater_than','less_than','between','truthy')),
  expected_value jsonb,
  operation text not null default 'add' check (operation in ('add','multiply','set','range')),
  price_delta numeric(14,2) not null default 0,
  min_delta numeric(14,2),
  max_delta numeric(14,2),
  requires_manual_review boolean not null default false,
  rule_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'submitted' check (status in ('draft','submitted','reviewing','quoted','accepted','rejected','cancelled')),
  answers jsonb not null default '{}'::jsonb,
  estimated_min numeric(14,2),
  estimated_max numeric(14,2),
  currency text not null default 'BRL',
  visitor_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, idempotency_key)
);

create table public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/png','image/jpeg','image/webp')),
  file_size bigint not null check (file_size between 1 and 5242880),
  created_at timestamptz not null default now()
);

create index quote_rules_definition_order_idx on public.quote_rules(quote_definition_id, rule_order);
create index quote_requests_project_created_idx on public.quote_requests(project_id, created_at desc);
create index quote_requests_project_status_idx on public.quote_requests(project_id, status);
create index quote_attachments_request_idx on public.quote_attachments(quote_request_id);

create trigger quote_definitions_set_updated_at before update on public.quote_definitions for each row execute function public.set_updated_at();
create trigger quote_requests_set_updated_at before update on public.quote_requests for each row execute function public.set_updated_at();

alter table public.quote_definitions enable row level security;
alter table public.quote_rules enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_attachments enable row level security;

create policy "quote definitions member all" on public.quote_definitions for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "quote definitions public" on public.quote_definitions for select to anon using (is_active and public.is_project_public(project_id));
create policy "quote rules member all" on public.quote_rules for all to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.quote_definitions where id = quote_definition_id)))) with check (public.is_workspace_member(public.project_workspace((select project_id from public.quote_definitions where id = quote_definition_id))));
create policy "quote rules public" on public.quote_rules for select to anon using (public.is_project_public((select project_id from public.quote_definitions where id = quote_definition_id)));
create policy "quote requests member read" on public.quote_requests for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "quote requests member update" on public.quote_requests for update to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "quote attachments member read" on public.quote_attachments for select to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.quote_requests where id = quote_request_id))));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('commercial-media','commercial-media',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

revoke all on public.quote_requests, public.quote_attachments from anon, authenticated;
grant select, update on public.quote_requests to authenticated;
grant select on public.quote_attachments to authenticated;
