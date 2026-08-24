import type { SupabaseClient } from "@supabase/supabase-js";
import { createOpportunity, type OpportunityFactoryInput } from "./factory";
import { upsertOpportunity } from "./repository";
import { recordProjectLifecycleMilestone } from "@/server/product-lifecycle/project-lifecycle";

export async function registerOpportunity(supabase: SupabaseClient, input: OpportunityFactoryInput) {
  const { data: existing } = await supabase.from("commercial_opportunities").select("id").eq("project_id", input.projectId).eq("source_type", input.sourceType).eq("source_id", input.sourceId).maybeSingle();
  const { data: session } = input.sessionId ? await supabase.from("visitor_sessions").select("id,project_version_id").eq("project_id", input.projectId).eq("session_key", input.sessionId).maybeSingle() : { data: null };
  const opportunity = createOpportunity({ ...input, sessionId: session?.id }); opportunity.projectVersionId = session?.project_version_id || undefined; const data = await upsertOpportunity(supabase, opportunity);
  if (!existing) {
    await supabase.from("opportunity_timeline").insert({ opportunity_id: data.id, event_type: "created", label: "Oportunidade criada", metadata: { sourceType: input.sourceType, sourceId: input.sourceId } });
    await supabase.from("analytics_events").insert({ project_id: input.projectId, project_version_id: session?.project_version_id || null, session_id: session?.id || null, event_name: input.activationId ? "activation_opportunity_created" : "opportunity_created", conversion_goal_id: input.conversionGoalId || null, entry_point_id: input.entryPointId || null, destination_id: input.destinationId || null, presence_page_id: input.presencePageId || input.attribution?.presencePageId || null, presence_section_id: input.presenceSectionId || input.attribution?.presenceSectionId || null, activation_id: input.activationId || null, benefit_claim_id: input.benefitClaimId || null, metadata: { sourceType: input.sourceType } });
    void recordProjectLifecycleMilestone(supabase, { eventName: "first_opportunity_generated", projectId: input.projectId, metadata: { sourceType: input.sourceType, versionId: session?.project_version_id || "unknown" } }).catch(() => undefined);
  }
  return data;
}
