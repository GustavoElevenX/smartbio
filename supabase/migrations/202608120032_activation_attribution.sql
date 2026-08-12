alter table public.visitor_sessions add column activation_id uuid references public.conversion_activations(id) on delete set null, add column benefit_claim_id uuid references public.benefit_claims(id) on delete set null;
alter table public.analytics_events add column activation_id uuid references public.conversion_activations(id) on delete set null, add column benefit_claim_id uuid references public.benefit_claims(id) on delete set null;
alter table public.commercial_opportunities add column activation_id uuid references public.conversion_activations(id) on delete set null, add column benefit_claim_id uuid references public.benefit_claims(id) on delete set null;
create index visitor_sessions_activation_idx on public.visitor_sessions(project_id,activation_id,started_at desc);
create index analytics_events_activation_idx on public.analytics_events(project_id,activation_id,created_at desc);
create index commercial_opportunities_activation_idx on public.commercial_opportunities(project_id,activation_id,created_at desc);

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check(event_name in (
 'page_view','session_started','step_viewed','option_clicked','form_started','form_submitted','recommendation_viewed','cta_clicked','whatsapp_clicked','external_link_clicked','journey_completed',
 'capability_started','qualification_completed','quote_started','quote_submitted','quote_estimate_viewed','media_uploaded','availability_searched','slot_selected','booking_submitted','booking_confirmed','booking_cancel_requested',
 'catalog_viewed','item_viewed','item_added','cart_viewed','order_submitted','reservation_search_started','reservation_option_viewed','reservation_submitted','reservation_confirmed','reservation_cancel_requested','route_resolved','payment_started',
 'entry_point_loaded','conversion_goal_selected','conversion_goal_resolved','opportunity_created','conversion_confirmed','conversion_lost','presence_page_viewed','presence_section_viewed','presence_cta_clicked','presence_conversion_started',
 'activation_viewed','activation_cta_clicked','activation_started','customer_identified','benefit_eligibility_checked','benefit_claim_issued','benefit_claim_presented','benefit_claim_redeemed','benefit_claim_rejected','activation_opportunity_created'
));
