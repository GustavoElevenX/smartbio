-- Activation snapshots, atomic draft saves, idempotent handoff and versioned claims.
alter table public.conversion_activations
  add column if not exists published_version integer,
  add column if not exists destination_mode text not null default 'fixed_destination'
    check (destination_mode in ('routing','fixed_destination','goal_default','native'));

comment on column public.conversion_activations.version is
  'Optimistic-concurrency version of the editable draft. Incremented only by save_conversion_activation.';
comment on column public.conversion_activations.published_version is
  'Draft version frozen in published_snapshot at the last publish.';

alter table public.benefit_claims
  add column if not exists activation_version integer,
  add column if not exists activation_snapshot_version integer;

create unique index if not exists customer_identities_project_external_idx
  on public.customer_identities(project_id, external_customer_id)
  where external_customer_id is not null;

create table public.activation_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  activation_id uuid not null references public.conversion_activations(id) on delete cascade,
  claim_id uuid not null references public.benefit_claims(id) on delete cascade,
  idempotency_key text not null,
  opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  presented_event_id bigint references public.analytics_events(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(project_id, activation_id, idempotency_key)
);
create index activation_handoffs_claim_idx on public.activation_handoffs(claim_id, created_at desc);
alter table public.activation_handoffs enable row level security;
create policy "activation handoffs member read" on public.activation_handoffs for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke all on public.activation_handoffs from anon, authenticated;
grant select on public.activation_handoffs to authenticated;

create or replace function public.save_conversion_activation(
  target_project uuid,
  target_workspace uuid,
  expected_version integer,
  activation_payload jsonb,
  offers_payload jsonb default '[]'::jsonb,
  placements_payload jsonb default '[]'::jsonb,
  entry_points_payload jsonb default '[]'::jsonb,
  locations_payload jsonb default '[]'::jsonb
) returns public.conversion_activations
language plpgsql security definer set search_path = '' as $$
declare
  v_activation_id uuid := (activation_payload ->> 'id')::uuid;
  current_row public.conversion_activations;
  result public.conversion_activations;
  next_version integer;
begin
  if public.project_workspace(target_project) is distinct from target_workspace then
    raise exception 'workspace_project_mismatch';
  end if;
  if auth.role() <> 'service_role' and not public.is_workspace_member(target_workspace) then
    raise exception 'access_denied';
  end if;

  select * into current_row from public.conversion_activations
   where id = v_activation_id and project_id = target_project and workspace_id = target_workspace
   for update;

  if found and expected_version is distinct from current_row.version then
    raise exception 'activation_version_conflict' using errcode = '40001';
  end if;
  if not found and expected_version is not null and expected_version <> 0 then
    raise exception 'activation_version_conflict' using errcode = '40001';
  end if;
  next_version := coalesce(current_row.version, 0) + 1;

  insert into public.conversion_activations (
    id,workspace_id,project_id,activation_key,name,description,activation_type,status,
    conversion_goal_id,default_destination_id,destination_mode,title,message,starts_at,ends_at,
    timezone,priority,requires_identity,identity_mode,completion_channel,eligibility,limits,settings,
    published_snapshot,published_at,published_version,version,created_by
  ) values (
    v_activation_id,target_workspace,target_project,activation_payload->>'activationKey',activation_payload->>'name',nullif(activation_payload->>'description',''),
    activation_payload->>'activationType',coalesce(activation_payload->>'status','draft'),nullif(activation_payload->>'conversionGoalId','')::uuid,
    nullif(activation_payload->>'defaultDestinationId','')::uuid,coalesce(activation_payload->>'destinationMode','fixed_destination'),
    nullif(activation_payload->>'title',''),nullif(activation_payload->>'message',''),nullif(activation_payload->>'startsAt','')::timestamptz,
    nullif(activation_payload->>'endsAt','')::timestamptz,coalesce(activation_payload->>'timezone','America/Sao_Paulo'),
    coalesce((activation_payload->>'priority')::integer,0),coalesce((activation_payload->>'requiresIdentity')::boolean,false),
    coalesce(activation_payload->>'identityMode','phone'),nullif(activation_payload->>'completionChannel',''),
    coalesce(activation_payload->'eligibility','{}'::jsonb),coalesce(activation_payload->'limits','{}'::jsonb),coalesce(activation_payload->'settings','{}'::jsonb),
    current_row.published_snapshot,current_row.published_at,current_row.published_version,next_version,coalesce(current_row.created_by,auth.uid())
  ) on conflict (id) do update set
    activation_key=excluded.activation_key,name=excluded.name,description=excluded.description,activation_type=excluded.activation_type,status=excluded.status,
    conversion_goal_id=excluded.conversion_goal_id,default_destination_id=excluded.default_destination_id,destination_mode=excluded.destination_mode,
    title=excluded.title,message=excluded.message,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,
    priority=excluded.priority,requires_identity=excluded.requires_identity,identity_mode=excluded.identity_mode,completion_channel=excluded.completion_channel,
    eligibility=excluded.eligibility,limits=excluded.limits,settings=excluded.settings,version=next_version,updated_at=now()
  returning * into result;

  insert into public.activation_offers(id,activation_id,offer_type,label,description,percentage,amount,special_price,currency,min_subtotal,max_discount,scope,benefit_config,is_active)
  select (x->>'id')::uuid,v_activation_id,x->>'offerType',x->>'label',nullif(x->>'description',''),nullif(x->>'percentage','')::numeric,
         nullif(x->>'amount','')::numeric,nullif(x->>'specialPrice','')::numeric,coalesce(x->>'currency','BRL'),nullif(x->>'minSubtotal','')::numeric,
         nullif(x->>'maxDiscount','')::numeric,coalesce(x->'scope','{}'::jsonb),coalesce(x->'benefitConfig','{}'::jsonb),coalesce((x->>'isActive')::boolean,true)
    from jsonb_array_elements(offers_payload) x
  on conflict (id) do update set offer_type=excluded.offer_type,label=excluded.label,description=excluded.description,percentage=excluded.percentage,
    amount=excluded.amount,special_price=excluded.special_price,currency=excluded.currency,min_subtotal=excluded.min_subtotal,max_discount=excluded.max_discount,
    scope=excluded.scope,benefit_config=excluded.benefit_config,is_active=excluded.is_active,updated_at=now();
  delete from public.activation_offers o where o.activation_id=v_activation_id
    and not exists(select 1 from jsonb_array_elements(offers_payload) x where (x->>'id')::uuid=o.id);

  insert into public.activation_placements(id,activation_id,presence_page_id,presence_section_id,placement_type,content,style,priority,is_active)
  select (x->>'id')::uuid,v_activation_id,nullif(x->>'presencePageId','')::uuid,nullif(x->>'presenceSectionId','')::uuid,x->>'placementType',
         coalesce(x->'content','{}'::jsonb),coalesce(x->'style','{}'::jsonb),coalesce((x->>'priority')::integer,0),coalesce((x->>'isActive')::boolean,true)
    from jsonb_array_elements(placements_payload) x
  on conflict (id) do update set presence_page_id=excluded.presence_page_id,presence_section_id=excluded.presence_section_id,
    placement_type=excluded.placement_type,content=excluded.content,style=excluded.style,priority=excluded.priority,is_active=excluded.is_active,updated_at=now();
  delete from public.activation_placements p where p.activation_id=v_activation_id
    and not exists(select 1 from jsonb_array_elements(placements_payload) x where (x->>'id')::uuid=p.id);

  insert into public.activation_entry_points(activation_id,entry_point_id)
  select v_activation_id,(jsonb_array_elements_text(entry_points_payload))::uuid on conflict do nothing;
  delete from public.activation_entry_points e where e.activation_id=v_activation_id
    and not (e.entry_point_id = any(array(select jsonb_array_elements_text(entry_points_payload)::uuid)));
  insert into public.activation_locations(activation_id,location_id)
  select v_activation_id,(jsonb_array_elements_text(locations_payload))::uuid on conflict do nothing;
  delete from public.activation_locations l where l.activation_id=v_activation_id
    and not (l.location_id = any(array(select jsonb_array_elements_text(locations_payload)::uuid)));

  insert into public.commercial_audit_log(workspace_id,project_id,actor_id,object_type,object_id,action,before_state,after_state)
  values(target_workspace,target_project,auth.uid(),'conversion_activation',v_activation_id,'draft_saved',to_jsonb(current_row),to_jsonb(result));
  return result;
end $$;

revoke all on function public.save_conversion_activation(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_conversion_activation(uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

create or replace function public.issue_benefit_claim(
  target_project uuid,target_activation uuid,target_offer uuid,target_customer uuid,target_session uuid,
  claim_code text,claim_expires_at timestamptz,eligibility jsonb,benefit jsonb
) returns public.benefit_claims language plpgsql security definer set search_path='' as $$
declare
  result public.benefit_claims; activation_row public.conversion_activations; existing public.benefit_claims;
  current_count bigint; customer_count bigint; redemption_count bigint; max_value integer;
begin
  select * into activation_row from public.conversion_activations where id=target_activation and project_id=target_project for update;
  if not found or activation_row.published_at is null or activation_row.status not in ('active','scheduled')
    or (activation_row.starts_at is not null and activation_row.starts_at>now()) or (activation_row.ends_at is not null and activation_row.ends_at<=now()) then raise exception 'invalid_activation'; end if;
  if activation_row.published_snapshot is null or (activation_row.published_snapshot->>'snapshotVersion')::integer<>1 then raise exception 'invalid_published_snapshot'; end if;
  select * into existing from public.benefit_claims where activation_id=target_activation and customer_identity_id=target_customer
    and status in ('issued','presented') and (expires_at is null or expires_at>now()) order by issued_at desc limit 1;
  if found then return existing; end if;
  select count(*) into current_count from public.benefit_claims where activation_id=target_activation and status not in ('cancelled','expired');
  select count(*) into customer_count from public.benefit_claims where activation_id=target_activation and customer_identity_id=target_customer and status not in ('cancelled','expired');
  select count(*) into redemption_count from public.benefit_redemptions where activation_id=target_activation and customer_identity_id=target_customer;
  max_value:=nullif(activation_row.published_snapshot->'limits'->>'maxClaims','')::integer;
  if max_value is not null and current_count>=max_value then raise exception 'global_limit_reached'; end if;
  max_value:=nullif(activation_row.published_snapshot->'limits'->>'maxClaimsPerCustomer','')::integer;
  if max_value is not null and customer_count>=max_value then raise exception 'customer_claim_limit_reached'; end if;
  max_value:=nullif(activation_row.published_snapshot->'limits'->>'maxRedemptionsPerCustomer','')::integer;
  if max_value is not null and redemption_count>=max_value then raise exception 'customer_redemption_limit_reached'; end if;
  insert into public.benefit_claims(workspace_id,project_id,activation_id,offer_id,customer_identity_id,visitor_session_id,code,expires_at,
    eligibility_snapshot,benefit_snapshot,activation_version,activation_snapshot_version)
  values(activation_row.workspace_id,target_project,target_activation,target_offer,target_customer,target_session,upper(claim_code),claim_expires_at,
    eligibility,benefit,(activation_row.published_snapshot->>'activationVersion')::integer,(activation_row.published_snapshot->>'snapshotVersion')::integer)
  returning * into result; return result;
end $$;

revoke all on function public.issue_benefit_claim(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.issue_benefit_claim(uuid,uuid,uuid,uuid,uuid,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function public.redeem_benefit_claim(
  claim_code text,target_project uuid,target_location uuid,target_validator uuid,redemption_mode text,
  subtotal numeric,discount numeric,delivery_discount numeric,final_amount numeric,currency text,
  target_opportunity uuid default null,idempotency_key text default null
) returns public.benefit_redemptions language plpgsql security definer set search_path='' as $$
declare claim_row public.benefit_claims; validator_row public.redemption_validators; result public.benefit_redemptions;
 current_count bigint; customer_count bigint; max_value integer; limits jsonb;
begin
 select * into claim_row from public.benefit_claims where project_id=target_project and code=upper(claim_code) for update;
 if not found then raise exception 'claim_not_found'; end if;
 if claim_row.status='redeemed' then select * into result from public.benefit_redemptions where claim_id=claim_row.id;return result;end if;
 if claim_row.status not in('issued','presented')then raise exception 'invalid_claim';end if;
 if claim_row.expires_at is not null and claim_row.expires_at<=now()then update public.benefit_claims set status='expired' where id=claim_row.id;raise exception 'claim_expired';end if;
 if target_validator is not null then select * into validator_row from public.redemption_validators where id=target_validator and project_id=target_project and is_active;
  if not found then raise exception 'validator_revoked';end if;if validator_row.location_id is not null and target_location is distinct from validator_row.location_id then raise exception 'location_not_allowed';end if;end if;
 if target_location is not null and exists(select 1 from public.activation_locations where activation_id=claim_row.activation_id)
  and not exists(select 1 from public.activation_locations where activation_id=claim_row.activation_id and location_id=target_location)then raise exception 'location_not_allowed';end if;
 limits:=coalesce((select published_snapshot->'limits' from public.conversion_activations where id=claim_row.activation_id),'{}'::jsonb);
 select count(*) into current_count from public.benefit_redemptions where activation_id=claim_row.activation_id;
 select count(*) into customer_count from public.benefit_redemptions where activation_id=claim_row.activation_id and customer_identity_id=claim_row.customer_identity_id;
 max_value:=nullif(limits->>'maxRedemptions','')::integer;if max_value is not null and current_count>=max_value then raise exception 'global_limit_reached';end if;
 max_value:=nullif(limits->>'maxRedemptionsPerCustomer','')::integer;if max_value is not null and customer_count>=max_value then raise exception 'customer_redemption_limit_reached';end if;
 insert into public.benefit_redemptions(workspace_id,project_id,claim_id,activation_id,offer_id,customer_identity_id,opportunity_id,location_id,subtotal_before,discount_amount,delivery_discount,final_amount,currency,redemption_mode,validator_id,metadata)
 values(claim_row.workspace_id,target_project,claim_row.id,claim_row.activation_id,claim_row.offer_id,claim_row.customer_identity_id,coalesce(target_opportunity,claim_row.opportunity_id),target_location,subtotal,discount,delivery_discount,final_amount,currency,redemption_mode,target_validator,jsonb_build_object('idempotencyKey',idempotency_key,'activationVersion',claim_row.activation_version))returning*into result;
 update public.benefit_claims set status='redeemed',redeemed_at=now(),opportunity_id=coalesce(target_opportunity,opportunity_id)where id=claim_row.id;
 insert into public.customer_identity_evidence(customer_identity_id,project_id,evidence_type,source_type,source_id)values(claim_row.customer_identity_id,target_project,'benefit_redeemed','benefit_redemption',result.id::text)on conflict do nothing;
 return result;
end $$;
revoke all on function public.redeem_benefit_claim(text,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text,uuid,text) from public,anon,authenticated;
grant execute on function public.redeem_benefit_claim(text,uuid,uuid,uuid,text,numeric,numeric,numeric,numeric,text,uuid,text) to service_role;
