-- Catálogo e solicitações de pedido com total recalculado no servidor.
create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  category_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  category_id uuid references public.catalog_categories(id) on delete set null,
  name text not null,
  description text,
  image_asset_id uuid references public.media_assets(id) on delete set null,
  price numeric(14,2),
  currency text not null default 'BRL',
  is_available boolean not null default true,
  variants jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  session_key text not null,
  idempotency_key text not null,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null default 'submitted' check (status in ('draft','submitted','confirmed','cancel_requested','cancelled')),
  fulfillment text not null check (fulfillment in ('delivery','pickup','digital','external')),
  location_id uuid,
  totals jsonb not null,
  visitor_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, idempotency_key)
);

create table public.order_request_items (
  id uuid primary key default gen_random_uuid(),
  order_request_id uuid not null references public.order_requests(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id) on delete restrict,
  variant_id text,
  name text not null,
  quantity integer not null check (quantity between 1 and 999),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index catalog_categories_project_order_idx on public.catalog_categories(project_id, category_order);
create index catalog_items_project_available_idx on public.catalog_items(project_id, is_available);
create index catalog_items_category_idx on public.catalog_items(category_id);
create index order_requests_project_created_idx on public.order_requests(project_id, created_at desc);
create index order_requests_project_status_idx on public.order_requests(project_id, status);
create index order_requests_lead_idx on public.order_requests(lead_id) where lead_id is not null;
create index order_request_items_order_idx on public.order_request_items(order_request_id);
create index order_request_items_item_idx on public.order_request_items(item_id);

create trigger catalog_categories_set_updated_at before update on public.catalog_categories for each row execute function public.set_updated_at();
create trigger catalog_items_set_updated_at before update on public.catalog_items for each row execute function public.set_updated_at();
create trigger order_requests_set_updated_at before update on public.order_requests for each row execute function public.set_updated_at();

alter table public.catalog_categories enable row level security;
alter table public.catalog_items enable row level security;
alter table public.order_requests enable row level security;
alter table public.order_request_items enable row level security;

create policy "catalog categories member all" on public.catalog_categories for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "catalog categories public" on public.catalog_categories for select to anon using (is_active and public.is_project_public(project_id));
create policy "catalog items member all" on public.catalog_items for all to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "catalog items public" on public.catalog_items for select to anon using (is_available and public.is_project_public(project_id));
create policy "orders member read" on public.order_requests for select to authenticated using (public.is_workspace_member(public.project_workspace(project_id)));
create policy "orders member update" on public.order_requests for update to authenticated using (public.is_workspace_member(public.project_workspace(project_id))) with check (public.is_workspace_member(public.project_workspace(project_id)));
create policy "order items member read" on public.order_request_items for select to authenticated using (public.is_workspace_member(public.project_workspace((select project_id from public.order_requests where id = order_request_id))));

create or replace function public.create_order_request(
  target_project uuid, request_session_key text, request_idempotency_key text,
  request_fulfillment text, target_location uuid, requested_items jsonb,
  requested_totals jsonb, requested_visitor_data jsonb
) returns public.order_requests language plpgsql security definer set search_path = '' as $$
declare existing public.order_requests; created public.order_requests; requested_item jsonb;
begin
  select * into existing from public.order_requests where project_id = target_project and idempotency_key = request_idempotency_key;
  if found then return existing; end if;
  if jsonb_array_length(coalesce(requested_items, '[]'::jsonb)) = 0 then raise exception 'empty_order' using errcode = 'P0001'; end if;
  insert into public.order_requests(project_id,session_key,idempotency_key,fulfillment,location_id,totals,visitor_data)
  values(target_project,request_session_key,request_idempotency_key,request_fulfillment,target_location,requested_totals,coalesce(requested_visitor_data,'{}'::jsonb)) returning * into created;
  for requested_item in select value from jsonb_array_elements(requested_items) loop
    insert into public.order_request_items(order_request_id,item_id,variant_id,name,quantity,unit_price,notes)
    select created.id,(requested_item->>'itemId')::uuid,requested_item->>'variantId',requested_item->>'name',
      (requested_item->>'quantity')::integer,(requested_item->>'unitPrice')::numeric,requested_item->>'notes'
    where exists(select 1 from public.catalog_items ci where ci.id = (requested_item->>'itemId')::uuid and ci.project_id = target_project and ci.is_available);
    if not found then raise exception 'item_unavailable' using errcode = 'P0001'; end if;
  end loop;
  return created;
end $$;

revoke all on public.order_requests, public.order_request_items from anon, authenticated;
grant select, update on public.order_requests to authenticated;
grant select on public.order_request_items to authenticated;
revoke all on function public.create_order_request(uuid,text,text,text,uuid,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_order_request(uuid,text,text,text,uuid,jsonb,jsonb,jsonb) to service_role;
