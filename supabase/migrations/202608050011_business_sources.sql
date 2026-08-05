-- Fontes privadas de negócio, extração auditável e revisão humana.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('business-sources','business-sources',false,15728640,array['application/pdf','text/plain','text/csv','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.business_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  setup_session_id uuid references public.ai_setup_sessions(id) on delete set null,
  source_type text not null check (source_type in ('website','text','pdf','image','csv')),
  name text not null,
  source_url text,
  storage_path text,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  checksum text,
  status text not null default 'pending' check (status in ('pending','uploaded','processing','processed','failed')),
  extracted_text text,
  extracted_data jsonb not null default '{}'::jsonb,
  processing_error text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_url is not null or storage_path is not null or source_type = 'text')
);

create table if not exists public.business_source_facts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.business_sources(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  fact_key text not null,
  fact_type text not null,
  fact_value jsonb not null,
  evidence_excerpt text,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_status text not null default 'needs_confirmation' check (verification_status in ('verified','needs_confirmation','rejected','invalid')),
  applied_at timestamptz,
  applied_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(source_id, fact_key, fact_value)
);

create index if not exists business_sources_workspace_created_idx on public.business_sources(workspace_id, created_at desc);
create index if not exists business_sources_project_status_idx on public.business_sources(project_id, status) where project_id is not null;
create index if not exists business_sources_setup_idx on public.business_sources(setup_session_id) where setup_session_id is not null;
create index if not exists business_sources_checksum_idx on public.business_sources(workspace_id, checksum) where checksum is not null;
create index if not exists business_source_facts_source_status_idx on public.business_source_facts(source_id, verification_status);
create index if not exists business_source_facts_project_key_idx on public.business_source_facts(project_id, fact_key) where project_id is not null;

drop trigger if exists business_sources_set_updated_at on public.business_sources;
create trigger business_sources_set_updated_at before update on public.business_sources for each row execute function public.set_updated_at();

alter table public.business_sources enable row level security;
alter table public.business_source_facts enable row level security;

drop policy if exists "business sources member all" on public.business_sources;
drop policy if exists "business source facts member all" on public.business_source_facts;
create policy "business sources member all" on public.business_sources for all to authenticated
  using (created_by = (select auth.uid()) and public.is_workspace_member(workspace_id))
  with check (created_by = (select auth.uid()) and public.is_workspace_member(workspace_id));
create policy "business source facts member all" on public.business_source_facts for all to authenticated
  using (exists(select 1 from public.business_sources s where s.id = source_id and s.created_by = (select auth.uid()) and public.is_workspace_member(s.workspace_id)))
  with check (exists(select 1 from public.business_sources s where s.id = source_id and s.created_by = (select auth.uid()) and public.is_workspace_member(s.workspace_id)));

drop policy if exists "business sources storage read" on storage.objects;
drop policy if exists "business sources storage insert" on storage.objects;
drop policy if exists "business sources storage update" on storage.objects;
drop policy if exists "business sources storage delete" on storage.objects;
create policy "business sources storage read" on storage.objects for select to authenticated
  using (bucket_id = 'business-sources' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "business sources storage insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'business-sources' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "business sources storage update" on storage.objects for update to authenticated
  using (bucket_id = 'business-sources' and public.is_workspace_member((storage.foldername(name))[1]::uuid));
create policy "business sources storage delete" on storage.objects for delete to authenticated
  using (bucket_id = 'business-sources' and public.is_workspace_member((storage.foldername(name))[1]::uuid));

grant select, insert, update, delete on public.business_sources, public.business_source_facts to authenticated;

create or replace function public.apply_verified_business_source_facts(
  p_workspace_id uuid,
  p_project_id uuid,
  p_actor_id uuid,
  p_fact_ids uuid[]
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  fact record;
  handled boolean;
  applied_count integer := 0;
  skipped_count integer := 0;
  fact_name text;
  fact_slug text;
  policy_kind text;
begin
  if not exists(select 1 from public.projects where id = p_project_id and workspace_id = p_workspace_id) then
    raise exception 'project_not_found';
  end if;
  for fact in
    select f.* from public.business_source_facts f
    join public.business_sources s on s.id = f.source_id
    where f.id = any(p_fact_ids)
      and f.verification_status = 'verified'
      and f.applied_at is null
      and s.workspace_id = p_workspace_id
      and (s.project_id is null or s.project_id = p_project_id)
  loop
    handled := false;
    fact_name := coalesce(fact.fact_value->>'name', fact.fact_value->>'title', case when jsonb_typeof(fact.fact_value) = 'string' then trim(both '"' from fact.fact_value::text) end);
    fact_slug := trim(both '-' from regexp_replace(translate(lower(coalesce(fact_name, '')),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]+', '-', 'g'));

    if (fact.fact_type in ('service','services') or fact.fact_key like 'service%') and coalesce(fact_name, '') <> '' then
      insert into public.service_offerings(project_id,name,slug,description,short_description,service_mode,price_mode,price,min_price,max_price,currency,settings)
      values(p_project_id,fact_name,coalesce(nullif(fact_slug,''),gen_random_uuid()::text),fact.fact_value->>'description',fact.fact_value->>'shortDescription',coalesce(fact.fact_value->>'serviceMode','contact'),case when fact.fact_value ? 'price' then 'fixed' else coalesce(fact.fact_value->>'priceMode','on_request') end,case when jsonb_typeof(fact.fact_value->'price')='number' then (fact.fact_value->>'price')::numeric end,case when jsonb_typeof(fact.fact_value->'minPrice')='number' then (fact.fact_value->>'minPrice')::numeric end,case when jsonb_typeof(fact.fact_value->'maxPrice')='number' then (fact.fact_value->>'maxPrice')::numeric end,coalesce(fact.fact_value->>'currency','BRL'),jsonb_build_object('sourceId',fact.source_id,'verified',true))
      on conflict(project_id,slug) do update set name=excluded.name,description=coalesce(excluded.description,public.service_offerings.description),price=coalesce(excluded.price,public.service_offerings.price),min_price=coalesce(excluded.min_price,public.service_offerings.min_price),max_price=coalesce(excluded.max_price,public.service_offerings.max_price),settings=public.service_offerings.settings||excluded.settings;
      handled := true;
    elsif (fact.fact_type in ('product','products') or fact.fact_key like 'product%') and coalesce(fact_name, '') <> '' then
      insert into public.catalog_items(project_id,name,description,price,currency,is_available,metadata)
      select p_project_id,fact_name,fact.fact_value->>'description',case when jsonb_typeof(fact.fact_value->'price')='number' then (fact.fact_value->>'price')::numeric end,coalesce(fact.fact_value->>'currency','BRL'),true,jsonb_build_object('sourceId',fact.source_id,'verified',true)
      where not exists(select 1 from public.catalog_items where project_id=p_project_id and lower(name)=lower(fact_name));
      handled := true;
    elsif (fact.fact_type in ('location','locations') or fact.fact_key like 'location%') and coalesce(fact_name, '') <> '' then
      insert into public.business_locations(project_id,name,address_line,address_number,neighborhood,city,state,postal_code,country_code,latitude,longitude,geocoding_status,phone,whatsapp,timezone,opening_hours,settings)
      select p_project_id,fact_name,fact.fact_value->>'addressLine',fact.fact_value->>'addressNumber',fact.fact_value->>'neighborhood',fact.fact_value->>'city',fact.fact_value->>'state',fact.fact_value->>'postalCode',coalesce(fact.fact_value->>'countryCode','BR'),case when jsonb_typeof(fact.fact_value->'latitude')='number' then (fact.fact_value->>'latitude')::double precision end,case when jsonb_typeof(fact.fact_value->'longitude')='number' then (fact.fact_value->>'longitude')::double precision end,case when fact.fact_value ? 'latitude' and fact.fact_value ? 'longitude' then 'resolved' else 'pending' end,fact.fact_value->>'phone',fact.fact_value->>'whatsapp',coalesce(fact.fact_value->>'timezone','America/Sao_Paulo'),coalesce(fact.fact_value->'openingHours','[]'::jsonb),jsonb_build_object('sourceId',fact.source_id,'verified',true)
      where not exists(select 1 from public.business_locations where project_id=p_project_id and lower(name)=lower(fact_name));
      handled := true;
    elsif (fact.fact_type in ('accommodation','accommodations','reservableUnits') or fact.fact_key like 'reserv%') and coalesce(fact_name, '') <> '' then
      insert into public.reservable_units(project_id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,settings)
      select p_project_id,fact_name,fact.fact_value->>'description',greatest(case when jsonb_typeof(fact.fact_value->'capacityAdults')='number' then (fact.fact_value->>'capacityAdults')::integer else 1 end,1),greatest(case when jsonb_typeof(fact.fact_value->'capacityChildren')='number' then (fact.fact_value->>'capacityChildren')::integer else 0 end,0),greatest(case when jsonb_typeof(fact.fact_value->'quantity')='number' then (fact.fact_value->>'quantity')::integer else 1 end,1),case when jsonb_typeof(fact.fact_value->'price')='number' then (fact.fact_value->>'price')::numeric end,coalesce(fact.fact_value->>'currency','BRL'),jsonb_build_object('sourceId',fact.source_id,'verified',true)
      where not exists(select 1 from public.reservable_units where project_id=p_project_id and lower(name)=lower(fact_name));
      handled := true;
    elsif (fact.fact_type in ('policy','policies') or fact.fact_key like 'polic%') and coalesce(fact_name, '') <> '' then
      policy_kind := coalesce(fact.fact_value->>'type','custom');
      if policy_kind not in ('privacy','cancellation','rescheduling','delivery','reservation','payment','custom') then policy_kind := 'custom'; end if;
      insert into public.project_policies(project_id,policy_type,title,content,settings)
      values(p_project_id,policy_kind,fact_name,coalesce(fact.fact_value->>'content',case when jsonb_typeof(fact.fact_value)='string' then trim(both '"' from fact.fact_value::text) else '' end),jsonb_build_object('sourceId',fact.source_id,'verified',true))
      on conflict(project_id,policy_type) do update set title=excluded.title,content=excluded.content,settings=public.project_policies.settings||excluded.settings;
      handled := true;
    end if;

    if handled then
      update public.business_source_facts set project_id=p_project_id,applied_at=now(),applied_by=p_actor_id where id=fact.id;
      applied_count := applied_count + 1;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;
  insert into public.commercial_audit_log(workspace_id,project_id,actor_id,object_type,object_id,action,after_state)
  values(p_workspace_id,p_project_id,p_actor_id,'business_source',p_project_id,'verified_facts_applied',jsonb_build_object('factIds',p_fact_ids,'applied',applied_count,'skipped',skipped_count));
  return jsonb_build_object('applied',applied_count,'skipped',skipped_count);
end $$;

revoke all on function public.apply_verified_business_source_facts(uuid,uuid,uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.apply_verified_business_source_facts(uuid,uuid,uuid,uuid[]) to service_role;
