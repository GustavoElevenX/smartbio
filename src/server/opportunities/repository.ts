import type { CommercialOpportunity } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function upsertOpportunity(supabase: SupabaseClient, opportunity: CommercialOpportunity) {
  const { data, error } = await supabase.from("commercial_opportunities").upsert({ workspace_id: opportunity.workspaceId, project_id: opportunity.projectId,
    session_id: opportunity.sessionId || null, conversion_goal_id: opportunity.conversionGoalId || null, entry_point_id: opportunity.entryPointId || null,
    destination_id: opportunity.destinationId || null, source_type: opportunity.sourceType, source_id: opportunity.sourceId, status: opportunity.status,
    title: opportunity.title, contact_name: opportunity.contactName || null, contact_email: opportunity.contactEmail || null, contact_phone: opportunity.contactPhone || null,
    summary: opportunity.summary || null, estimated_value: opportunity.estimatedValue ?? null, confirmed_value: opportunity.confirmedValue ?? null,
    currency: opportunity.currency, attribution: opportunity.attribution || {}, metadata: opportunity.metadata,
  }, { onConflict: "project_id,source_type,source_id" }).select("*").single();
  if (error) throw new Error(error.message); return data;
}
