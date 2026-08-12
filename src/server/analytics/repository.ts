import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsFilters } from "./queries";

export async function loadConversionAnalyticsRows(supabase: SupabaseClient, projectId: string, filters: AnalyticsFilters = {}) {
  let eventQuery = supabase.from("analytics_events").select("id,project_id,event_name,session_id,step_id,option_id,conversion_goal_id,entry_point_id,destination_id,presence_page_id,presence_section_id,metadata,created_at").eq("project_id", projectId);
  let opportunityQuery = supabase.from("commercial_opportunities").select("id,project_id,session_id,conversion_goal_id,entry_point_id,destination_id,presence_page_id,presence_section_id,source_type,source_id,status,title,estimated_value,confirmed_value,currency,attribution,metadata,created_at,updated_at").eq("project_id", projectId);
  if (filters.from) { eventQuery = eventQuery.gte("created_at", filters.from); opportunityQuery = opportunityQuery.gte("created_at", filters.from); }
  if (filters.to) { eventQuery = eventQuery.lte("created_at", filters.to); opportunityQuery = opportunityQuery.lte("created_at", filters.to); }
  for (const [key, value] of [["conversion_goal_id", filters.goalId], ["entry_point_id", filters.entryId], ["destination_id", filters.destinationId]] as const) if (value) { eventQuery = eventQuery.eq(key, value); opportunityQuery = opportunityQuery.eq(key, value); }
  const [events, opportunities] = await Promise.all([eventQuery, opportunityQuery]);
  if (events.error) throw new Error(events.error.message); if (opportunities.error) throw new Error(opportunities.error.message);
  return { events: events.data || [], opportunities: opportunities.data || [] };
}
