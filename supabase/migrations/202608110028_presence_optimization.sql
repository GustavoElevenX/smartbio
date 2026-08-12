alter table public.optimization_suggestions drop constraint if exists optimization_suggestions_suggestion_kind_check;
alter table public.optimization_suggestions add constraint optimization_suggestions_suggestion_kind_check
  check (suggestion_kind in ('goal_dropoff','entry_underperformance','destination_friction','journey_friction','presence_cta','presence_structure','landing_page'));
