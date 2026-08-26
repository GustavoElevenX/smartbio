-- Activation runtime hardening: analytics observáveis e semântica persistente de fallback.
alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check(event_name in (
  'page_view','session_started','step_viewed','option_clicked','form_started','form_submitted','recommendation_viewed','cta_clicked','whatsapp_clicked','external_link_clicked','journey_completed',
  'journey_started','journey_answered','journey_context_completed','location_selected','route_unresolved','handoff_built','external_url_clicked','lead_captured',
  'capability_started','qualification_completed','quote_started','quote_submitted','quote_estimate_viewed','media_uploaded','availability_searched','slot_selected','booking_submitted','booking_confirmed','booking_cancel_requested',
  'catalog_viewed','item_viewed','item_added','cart_viewed','order_submitted','reservation_search_started','reservation_option_viewed','reservation_submitted','reservation_confirmed','reservation_cancel_requested','route_resolved','payment_started',
  'entry_point_loaded','conversion_goal_selected','conversion_goal_resolved','opportunity_created','conversion_confirmed','conversion_lost','presence_page_viewed','presence_section_viewed','presence_cta_clicked','presence_conversion_started',
  'activation_viewed','activation_cta_clicked','activation_started','customer_identified','benefit_eligibility_checked','benefit_claim_issued','benefit_claim_presented','benefit_claim_redeemed','benefit_claim_rejected','activation_opportunity_created'
));

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
        'role', item->>'role'
      )
      where project_id = new.id and id = nullif(item->>'id','')::uuid;
  end loop;
  return new;
end $$;

drop trigger if exists projects_sync_routing_destination_semantics on public.projects;
create trigger projects_sync_routing_destination_semantics
after insert or update of settings on public.projects
for each row execute function public.sync_project_routing_destination_semantics();

with semantics as (
  select
    project.id project_id,
    nullif(item->>'id','')::uuid destination_id,
    coalesce((item->>'isDefault')::boolean,false) is_default,
    item->>'role' destination_role
  from public.projects project
  cross join lateral jsonb_array_elements(coalesce(project.settings#>'{projectPayload,commercialConfig,routingDestinations}','[]'::jsonb)) item
)
update public.routing_destinations destination
set settings = coalesce(destination.settings,'{}'::jsonb) || jsonb_build_object('isDefault',semantics.is_default,'role',semantics.destination_role)
from semantics
where destination.project_id=semantics.project_id and destination.id=semantics.destination_id;
