-- Preserve destination ownership so runtime routing can enforce the selected unit.
create or replace function public.sync_project_routing_destination_semantics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
begin
  for item in select value from jsonb_array_elements(coalesce(new.settings#>'{projectPayload,commercialConfig,routingDestinations}','[]'::jsonb)) loop
    update public.routing_destinations
      set settings = coalesce(settings,'{}'::jsonb) || jsonb_build_object(
        'isDefault', coalesce((item->>'isDefault')::boolean,false),
        'role', item->>'role',
        'locationId', item->>'locationId'
      )
      where project_id = new.id and id = nullif(item->>'id','')::uuid;
  end loop;
  return new;
end $$;

with semantics as (
  select
    project.id project_id,
    nullif(item->>'id','')::uuid destination_id,
    item->>'locationId' location_id
  from public.projects project
  cross join lateral jsonb_array_elements(coalesce(project.settings#>'{projectPayload,commercialConfig,routingDestinations}','[]'::jsonb)) item
)
update public.routing_destinations destination
set settings = coalesce(destination.settings,'{}'::jsonb) || jsonb_build_object('locationId',semantics.location_id)
from semantics
where destination.project_id=semantics.project_id and destination.id=semantics.destination_id;
