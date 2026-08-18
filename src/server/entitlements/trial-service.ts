import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SOBE_TRIAL } from "@/lib/sobe-pro";

export async function activateTrialAfterFirstStructure(
  database: SupabaseClient,
  workspaceId: string,
) {
  const { data: assignment, error } = await database
    .from("workspace_plan_assignments")
    .select("plan_key,status,ends_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (
    !assignment ||
    assignment.plan_key !== SOBE_TRIAL.key ||
    assignment.status !== "active" ||
    assignment.ends_at
  ) {
    return assignment;
  }

  const activatedAt = new Date();
  const endsAt = new Date(activatedAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + SOBE_TRIAL.days);
  const { data, error: updateError } = await database
    .from("workspace_plan_assignments")
    .update({
      ends_at: endsAt.toISOString(),
      reason: "trial_started_after_first_structure",
      updated_at: activatedAt.toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("plan_key", SOBE_TRIAL.key)
    .is("ends_at", null)
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;
  return data || assignment;
}

export async function isWorkspacePublicAccessActive(
  database: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await database
    .from("workspace_plan_assignments")
    .select("status,ends_at")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data || data.status !== "active") return false;
  return !data.ends_at || new Date(data.ends_at) > new Date();
}
