-- Salvamento atômico da Central de Dados com concorrência otimista e exclusões explícitas.
alter table public.project_capabilities drop constraint if exists project_capabilities_capability_key_check;
alter table public.project_capabilities add constraint project_capabilities_capability_key_check
  check (capability_key in ('qualification','quote','scheduling','catalog_order','reservation','routing','payment'));

create or replace function public.save_project_commercial_data(
  p_workspace_id uuid,
  p_project_id uuid,
  p_actor_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row record;
  config jsonb := coalesce(p_payload->'data','{}'::jsonb);
  deleted jsonb := coalesce(p_payload->'deleted','{}'::jsonb);
  item jsonb;
  current_version integer;
  expected_version integer := coalesce((p_payload->>'expectedProjectVersion')::integer,0);
  next_version integer;
  previous_snapshot jsonb;
  next_snapshot jsonb;
  quote_definition_id uuid;
begin
  if not exists(select 1 from public.workspace_members where workspace_id=p_workspace_id and user_id=p_actor_id) then
    raise exception 'workspace_access_denied';
  end if;
  select * into project_row from public.projects
    where id=p_project_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'project_not_found'; end if;
  current_version := coalesce((project_row.settings->>'version')::integer,1);
  if expected_version <> current_version then
    raise exception 'project_version_conflict' using errcode='40001', detail=current_version::text;
  end if;
  next_version := current_version + 1;
  previous_snapshot := coalesce(project_row.settings->'projectPayload','{}'::jsonb);
  insert into public.project_versions(project_id,version_number,snapshot,created_by)
    values(p_project_id,next_version,previous_snapshot,p_actor_id)
    on conflict(project_id,version_number) do nothing;

  -- Destinos primeiro: serviços, regras e unidades podem referenciá-los.
  for item in select value from jsonb_array_elements(coalesce(config->'routingDestinations','[]'::jsonb)) loop
    insert into public.routing_destinations(id,project_id,label,channel,value,is_active,settings)
    values((item->>'id')::uuid,p_project_id,item->>'label',case when item->>'type' in ('whatsapp','email','phone') then item->>'type' when item->>'type' in ('url','checkout','schedule','form') then 'url' else 'internal' end,coalesce(item->>'value',item->>'key'),true,jsonb_build_object('message',item->>'message','type',item->>'type','key',item->>'key'))
    on conflict(id) do update set label=excluded.label,channel=excluded.channel,value=excluded.value,settings=excluded.settings,updated_at=now()
    where public.routing_destinations.project_id=p_project_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(config->'serviceOfferings','[]'::jsonb)) loop
    insert into public.service_offerings(id,project_id,name,slug,description,short_description,service_mode,price_mode,price,min_price,max_price,currency,image_asset_id,destination_id,external_url,is_featured,is_active,service_order,settings)
    values((item->>'id')::uuid,p_project_id,item->>'name',item->>'slug',item->>'description',item->>'shortDescription',item->>'serviceMode',item->>'priceMode',(item->>'price')::numeric,(item->>'minPrice')::numeric,(item->>'maxPrice')::numeric,item->>'currency',nullif(item->>'imageAssetId','')::uuid,nullif(item->>'destinationId','')::uuid,item->>'externalUrl',coalesce((item->>'isFeatured')::boolean,false),coalesce((item->>'isActive')::boolean,true),coalesce((item->>'order')::integer,0),coalesce(item->'settings','{}'::jsonb))
    on conflict(id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,short_description=excluded.short_description,service_mode=excluded.service_mode,price_mode=excluded.price_mode,price=excluded.price,min_price=excluded.min_price,max_price=excluded.max_price,currency=excluded.currency,image_asset_id=excluded.image_asset_id,destination_id=excluded.destination_id,external_url=excluded.external_url,is_featured=excluded.is_featured,is_active=excluded.is_active,service_order=excluded.service_order,settings=excluded.settings,updated_at=now()
    where public.service_offerings.project_id=p_project_id;
  end loop;

  if config ? 'quoteDefinition' and jsonb_typeof(config->'quoteDefinition')='object' then
    item := config->'quoteDefinition';
    insert into public.quote_definitions(id,project_id,name,currency,base_price,is_active,settings)
    values((item->>'id')::uuid,p_project_id,item->>'title',item->>'currency',(item->>'baseAmount')::numeric,coalesce((item->>'isActive')::boolean,true),jsonb_build_object('estimationMode',item->>'estimationMode','completionChannel',item->>'completionChannel'))
    on conflict(project_id) do update set name=excluded.name,currency=excluded.currency,base_price=excluded.base_price,is_active=excluded.is_active,settings=excluded.settings,updated_at=now()
    returning id into quote_definition_id;
    for item in select value from jsonb_array_elements(coalesce(config#>'{quoteDefinition,questions}','[]'::jsonb)) loop
      insert into public.quote_questions(id,quote_definition_id,field_key,label,field_type,required,options,question_order,settings)
      values((item->>'id')::uuid,quote_definition_id,item->>'key',item->>'label',item->>'type',coalesce((item->>'required')::boolean,false),coalesce(item->'options','[]'::jsonb),coalesce((select ordinality-1 from jsonb_array_elements(config#>'{quoteDefinition,questions}') with ordinality q(value,ordinality) where q.value->>'id'=item->>'id' limit 1),0),jsonb_build_object('placeholder',item->>'placeholder'))
      on conflict(id) do update set field_key=excluded.field_key,label=excluded.label,field_type=excluded.field_type,required=excluded.required,options=excluded.options,question_order=excluded.question_order,settings=excluded.settings
      where public.quote_questions.quote_definition_id=quote_definition_id;
    end loop;
    for item in select value from jsonb_array_elements(coalesce(config#>'{quoteDefinition,rules}','[]'::jsonb)) loop
      insert into public.quote_rules(id,quote_definition_id,field_key,operator,expected_value,operation,price_delta,min_delta,max_delta,rule_order)
      values((item->>'id')::uuid,quote_definition_id,item#>>'{condition,field}',item#>>'{condition,operator}',item#>'{condition,value}',item->>'operation',coalesce((item->>'amount')::numeric,0),(item->>'minAmount')::numeric,(item->>'maxAmount')::numeric,coalesce((select ordinality-1 from jsonb_array_elements(config#>'{quoteDefinition,rules}') with ordinality q(value,ordinality) where q.value->>'id'=item->>'id' limit 1),0))
      on conflict(id) do update set field_key=excluded.field_key,operator=excluded.operator,expected_value=excluded.expected_value,operation=excluded.operation,price_delta=excluded.price_delta,min_delta=excluded.min_delta,max_delta=excluded.max_delta,rule_order=excluded.rule_order
      where public.quote_rules.quote_definition_id=quote_definition_id;
    end loop;
  end if;

  for item in select value from jsonb_array_elements(coalesce(config->'schedulableServices','[]'::jsonb)) loop
    insert into public.schedulable_services(id,project_id,service_offering_id,name,duration_minutes,buffer_before_minutes,buffer_after_minutes,confirmation_mode,is_active,settings)
    values((item->>'id')::uuid,p_project_id,nullif(item->>'serviceOfferingId','')::uuid,item->>'name',(item->>'durationMinutes')::integer,coalesce((item->>'bufferBeforeMinutes')::integer,0),coalesce((item->>'bufferAfterMinutes')::integer,0),item->>'confirmationMode',coalesce((item->>'isActive')::boolean,true),jsonb_build_object('capacity',(item->>'capacity')::integer))
    on conflict(id) do update set service_offering_id=excluded.service_offering_id,name=excluded.name,duration_minutes=excluded.duration_minutes,buffer_before_minutes=excluded.buffer_before_minutes,buffer_after_minutes=excluded.buffer_after_minutes,confirmation_mode=excluded.confirmation_mode,is_active=excluded.is_active,settings=excluded.settings,updated_at=now()
    where public.schedulable_services.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'resources','[]'::jsonb)) loop
    insert into public.resources(id,project_id,name,resource_type,is_active)
    values((item->>'id')::uuid,p_project_id,item->>'name',item->>'kind',coalesce((item->>'isActive')::boolean,true))
    on conflict(id) do update set name=excluded.name,resource_type=excluded.resource_type,is_active=excluded.is_active,updated_at=now()
    where public.resources.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'availabilityRules','[]'::jsonb)) loop
    insert into public.availability_rules(id,project_id,resource_id,weekday,starts_at,ends_at,timezone,is_active)
    values((item->>'id')::uuid,p_project_id,nullif(item->>'resourceId','')::uuid,(item->>'weekday')::integer,(item->>'startTime')::time,(item->>'endTime')::time,item->>'timezone',true)
    on conflict(id) do update set resource_id=excluded.resource_id,weekday=excluded.weekday,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,updated_at=now()
    where public.availability_rules.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'availabilityExceptions','[]'::jsonb)) loop
    insert into public.availability_exceptions(id,project_id,resource_id,starts_at,ends_at,is_available,reason)
    values((item->>'id')::uuid,p_project_id,nullif(item->>'resourceId','')::uuid,(item->>'startsAt')::timestamptz,(item->>'endsAt')::timestamptz,(item->>'isAvailable')::boolean,item->>'reason')
    on conflict(id) do update set resource_id=excluded.resource_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,is_available=excluded.is_available,reason=excluded.reason,updated_at=now()
    where public.availability_exceptions.project_id=p_project_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(config->'catalogCategories','[]'::jsonb)) loop
    insert into public.catalog_categories(id,project_id,name,category_order,is_active)
    values((item->>'id')::uuid,p_project_id,item->>'name',coalesce((item->>'order')::integer,0),coalesce((item->>'isActive')::boolean,true))
    on conflict(id) do update set name=excluded.name,category_order=excluded.category_order,is_active=excluded.is_active,updated_at=now()
    where public.catalog_categories.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'catalogItems','[]'::jsonb)) loop
    insert into public.catalog_items(id,project_id,category_id,name,description,image_asset_id,price,currency,is_available,variants,metadata)
    values((item->>'id')::uuid,p_project_id,nullif(item->>'categoryId','')::uuid,item->>'name',item->>'description',nullif(item->>'imageAssetId','')::uuid,(item->>'price')::numeric,item->>'currency',coalesce((item->>'isAvailable')::boolean,false),coalesce(item->'variants','[]'::jsonb),coalesce(item->'metadata','{}'::jsonb)||jsonb_build_object('isFeatured',item->'isFeatured','order',item->'order'))
    on conflict(id) do update set category_id=excluded.category_id,name=excluded.name,description=excluded.description,image_asset_id=excluded.image_asset_id,price=excluded.price,currency=excluded.currency,is_available=excluded.is_available,variants=excluded.variants,metadata=excluded.metadata,updated_at=now()
    where public.catalog_items.project_id=p_project_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(config->'reservableUnits','[]'::jsonb)) loop
    insert into public.reservable_units(id,project_id,name,description,capacity_adults,capacity_children,quantity,base_price,currency,is_active,media_asset_ids,amenities,settings)
    values((item->>'id')::uuid,p_project_id,item->>'name',item->>'description',(item->>'capacityAdults')::integer,(item->>'capacityChildren')::integer,(item->>'quantity')::integer,(item->>'basePrice')::numeric,item->>'currency',coalesce((item->>'isActive')::boolean,false),coalesce(item->'mediaAssetIds','[]'::jsonb),coalesce(item->'amenities','[]'::jsonb),jsonb_build_object('depositAmount',item->'depositAmount','confirmationMode',item->'confirmationMode','rules',item->'rules'))
    on conflict(id) do update set name=excluded.name,description=excluded.description,capacity_adults=excluded.capacity_adults,capacity_children=excluded.capacity_children,quantity=excluded.quantity,base_price=excluded.base_price,currency=excluded.currency,is_active=excluded.is_active,media_asset_ids=excluded.media_asset_ids,amenities=excluded.amenities,settings=excluded.settings,updated_at=now()
    where public.reservable_units.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'reservationBlocks','[]'::jsonb)) loop
    insert into public.reservation_blocks(id,project_id,unit_id,starts_on,ends_on,quantity,reason)
    values((item->>'id')::uuid,p_project_id,nullif(item->>'unitId','')::uuid,(item->>'startsOn')::date,(item->>'endsOn')::date,(item->>'quantity')::integer,item->>'reason')
    on conflict(id) do update set unit_id=excluded.unit_id,starts_on=excluded.starts_on,ends_on=excluded.ends_on,quantity=excluded.quantity,reason=excluded.reason,updated_at=now()
    where public.reservation_blocks.project_id=p_project_id;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(config->'locations','[]'::jsonb)) loop
    insert into public.business_locations(id,project_id,name,address_line,address_number,address_extra,neighborhood,city,state,postal_code,country_code,latitude,longitude,geocoding_status,geocoding_provider,geocoded_at,phone,whatsapp,external_url,timezone,opening_hours,service_radius_km,delivery_radius_km,supports_delivery,supports_pickup,supports_in_person,priority,is_active,routing_destination_id,settings)
    values((item->>'id')::uuid,p_project_id,item->>'name',coalesce(item->>'addressLine',item->>'address'),item->>'addressNumber',item->>'addressExtra',item->>'neighborhood',item->>'city',item->>'state',item->>'postalCode',item->>'countryCode',(item->>'latitude')::double precision,(item->>'longitude')::double precision,item->>'geocodingStatus',item->>'geocodingProvider',(item->>'geocodedAt')::timestamptz,item->>'phone',item->>'whatsapp',item->>'externalUrl',item->>'timezone',coalesce(item->'openingHours','[]'::jsonb),(item->>'serviceRadiusKm')::numeric,(item->>'deliveryRadiusKm')::numeric,coalesce((item->>'supportsDelivery')::boolean,false),coalesce((item->>'supportsPickup')::boolean,false),coalesce((item->>'supportsInPerson')::boolean,false),coalesce((item->>'priority')::integer,0),coalesce((item->>'isActive')::boolean,false),nullif(item->>'routingDestinationId','')::uuid,coalesce(item->'settings','{}'::jsonb))
    on conflict(id) do update set name=excluded.name,address_line=excluded.address_line,address_number=excluded.address_number,address_extra=excluded.address_extra,neighborhood=excluded.neighborhood,city=excluded.city,state=excluded.state,postal_code=excluded.postal_code,country_code=excluded.country_code,latitude=excluded.latitude,longitude=excluded.longitude,geocoding_status=excluded.geocoding_status,geocoding_provider=excluded.geocoding_provider,geocoded_at=excluded.geocoded_at,phone=excluded.phone,whatsapp=excluded.whatsapp,external_url=excluded.external_url,timezone=excluded.timezone,opening_hours=excluded.opening_hours,service_radius_km=excluded.service_radius_km,delivery_radius_km=excluded.delivery_radius_km,supports_delivery=excluded.supports_delivery,supports_pickup=excluded.supports_pickup,supports_in_person=excluded.supports_in_person,priority=excluded.priority,is_active=excluded.is_active,routing_destination_id=excluded.routing_destination_id,settings=excluded.settings,updated_at=now()
    where public.business_locations.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'routingRules','[]'::jsonb)) loop
    insert into public.routing_rules(id,project_id,destination_id,conditions,priority,is_active)
    values((item->>'id')::uuid,p_project_id,(item->>'destinationId')::uuid,jsonb_build_array(item->'condition'),(item->>'priority')::integer,coalesce((item->>'isActive')::boolean,true))
    on conflict(id) do update set destination_id=excluded.destination_id,conditions=excluded.conditions,priority=excluded.priority,is_active=excluded.is_active,updated_at=now()
    where public.routing_rules.project_id=p_project_id;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(config->'policies','[]'::jsonb)) loop
    insert into public.project_policies(id,project_id,policy_type,title,content,is_active,settings)
    values((item->>'id')::uuid,p_project_id,item->>'type',item->>'title',item->>'content',coalesce((item->>'isActive')::boolean,true),coalesce(item->'settings','{}'::jsonb))
    on conflict(project_id,policy_type) do update set title=excluded.title,content=excluded.content,is_active=excluded.is_active,settings=excluded.settings,updated_at=now();
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_payload->'capabilities','[]'::jsonb)) loop
    insert into public.project_capabilities(project_id,capability_key,enabled,source,settings)
    values(p_project_id,item->>'key',(item->>'enabled')::boolean,item->>'source',coalesce(item->'configuration','{}'::jsonb)||jsonb_build_object('version',(item->>'version')::integer))
    on conflict(project_id,capability_key) do update set enabled=excluded.enabled,source=excluded.source,settings=excluded.settings,updated_at=now();
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_payload->'dataRequirements','[]'::jsonb)) loop
    insert into public.project_data_requirements(project_id,requirement_key,label,capability_key,status,severity,value,origin,source_id,reason,field_metadata)
    values(p_project_id,item->>'key',item->>'label',item->>'capability',item->>'status',item->>'severity',item->'value',item->>'origin',item->>'sourceId',item->>'reason',coalesce(item->'fieldMetadata','{}'::jsonb))
    on conflict(project_id,requirement_key) do update set label=excluded.label,capability_key=excluded.capability_key,status=excluded.status,severity=excluded.severity,value=excluded.value,origin=excluded.origin,source_id=excluded.source_id,reason=excluded.reason,field_metadata=excluded.field_metadata,updated_at=now();
  end loop;

  delete from public.service_offerings where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'serviceOfferingIds','[]'::jsonb)));
  delete from public.quote_questions where id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'quoteQuestionIds','[]'::jsonb))) and quote_definition_id=quote_definition_id;
  delete from public.catalog_items where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'catalogItemIds','[]'::jsonb)));
  delete from public.catalog_categories where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'catalogCategoryIds','[]'::jsonb)));
  delete from public.resources where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'resourceIds','[]'::jsonb)));
  delete from public.business_locations where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'locationIds','[]'::jsonb)));
  delete from public.project_policies where project_id=p_project_id and id in (select value::text::uuid from jsonb_array_elements_text(coalesce(deleted->'policyIds','[]'::jsonb)));

  next_snapshot := case when jsonb_typeof(previous_snapshot)='object' then previous_snapshot else '{}'::jsonb end;
  next_snapshot := next_snapshot || jsonb_build_object('commercialConfig',config,'capabilities',coalesce(p_payload->'capabilities','[]'::jsonb),'dataRequirements',coalesce(p_payload->'dataRequirements','[]'::jsonb),'version',next_version,'updatedAt',now());
  update public.projects set settings=project_row.settings||jsonb_build_object('version',next_version,'projectPayload',next_snapshot),updated_at=now() where id=p_project_id;
  insert into public.commercial_audit_log(workspace_id,project_id,actor_id,object_type,object_id,action,before_state,after_state)
  values(p_workspace_id,p_project_id,p_actor_id,'commercial_data',p_project_id,'configuration_saved',previous_snapshot->'commercialConfig',config);
  return jsonb_build_object('projectId',p_project_id,'version',next_version,'commercialConfig',config,'capabilities',p_payload->'capabilities','dataRequirements',p_payload->'dataRequirements');
end $$;

revoke all on function public.save_project_commercial_data(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_project_commercial_data(uuid,uuid,uuid,jsonb) to service_role;
