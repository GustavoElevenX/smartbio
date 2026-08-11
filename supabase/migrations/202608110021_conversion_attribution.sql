alter table public.visitor_sessions
  add column conversion_goal_id uuid references public.conversion_goals(id) on delete set null,
  add column entry_point_id uuid references public.entry_points(id) on delete set null,
  add column destination_id uuid references public.routing_destinations(id) on delete set null;

alter table public.analytics_events
  add column conversion_goal_id uuid references public.conversion_goals(id) on delete set null,
  add column entry_point_id uuid references public.entry_points(id) on delete set null,
  add column destination_id uuid references public.routing_destinations(id) on delete set null;

alter table public.analytics_events drop constraint if exists analytics_events_event_name_check;
alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view','session_started','step_viewed','option_clicked','form_started','form_submitted','recommendation_viewed',
  'cta_clicked','whatsapp_clicked','external_link_clicked','journey_completed','capability_started','qualification_completed',
  'quote_started','quote_submitted','quote_estimate_viewed','media_uploaded','availability_searched','slot_selected',
  'booking_submitted','booking_confirmed','booking_cancel_requested','catalog_viewed','item_viewed','item_added','cart_viewed',
  'order_submitted','reservation_search_started','reservation_option_viewed','reservation_submitted','reservation_confirmed',
  'reservation_cancel_requested','route_resolved','payment_started','entry_point_loaded','conversion_goal_selected',
  'conversion_goal_resolved','opportunity_created','conversion_confirmed','conversion_lost'
));

create index visitor_sessions_project_started_idx on public.visitor_sessions(project_id, started_at desc);
create index visitor_sessions_goal_started_idx on public.visitor_sessions(project_id, conversion_goal_id, started_at desc);
create index visitor_sessions_entry_started_idx on public.visitor_sessions(project_id, entry_point_id, started_at desc);
create index analytics_events_project_created_idx on public.analytics_events(project_id, created_at desc);
create index analytics_events_project_goal_created_idx on public.analytics_events(project_id, conversion_goal_id, created_at desc);
create index analytics_events_project_entry_created_idx on public.analytics_events(project_id, entry_point_id, created_at desc);
create index analytics_events_project_destination_created_idx on public.analytics_events(project_id, destination_id, created_at desc);
