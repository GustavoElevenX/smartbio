import type { SupabaseClient } from "@supabase/supabase-js";
import { createOpportunity, type OpportunityFactoryInput } from "./factory";
import { upsertOpportunity } from "./repository";

export async function registerOpportunity(supabase: SupabaseClient, input: OpportunityFactoryInput) {
  const { data: existing } = await supabase.from("commercial_opportunities").select("id").eq("project_id", input.projectId).eq("source_type", input.sourceType).eq("source_id", input.sourceId).maybeSingle();
  const { data: session } = input.sessionId ? await supabase.from("visitor_sessions").select("id").eq("session_key", input.sessionId).maybeSingle() : { data: null };
  const opportunity = createOpportunity({ ...input, sessionId: session?.id }); const data = await upsertOpportunity(supabase, opportunity);
  if (!existing) {
    await supabase.from("opportunity_timeline").insert({ opportunity_id: data.id, event_type: "created", label: "Oportunidade criada", metadata: { sourceType: input.sourceType, sourceId: input.sourceId } });
    await supabase.from("analytics_events").insert({ project_id: input.projectId, session_id: session?.id || null, event_name: "opportunity_created", conversion_goal_id: input.conversionGoalId || null, entry_point_id: input.entryPointId || null, destination_id: input.destinationId || null, metadata: { sourceType: input.sourceType } });
  }
  return data;
}
