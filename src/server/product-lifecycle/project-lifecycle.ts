import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformEventName } from "@/server/platform-acquisition/platform-acquisition";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";

const PROJECT_MILESTONES = new Set<PlatformEventName>([
  "first_traffic_received",
  "first_opportunity_generated",
  "first_conversion_confirmed",
]);

export async function recordProjectLifecycleMilestone(
  database: SupabaseClient,
  input: { eventName: PlatformEventName; projectId: string; metadata?: Record<string, unknown> },
) {
  if (!PROJECT_MILESTONES.has(input.eventName)) throw new Error("invalid_project_milestone");
  const { data: project } = await database.from("projects").select("workspace_id").eq("id", input.projectId).maybeSingle();
  if (!project?.workspace_id) return;
  const { data: owner } = await database.from("workspace_members").select("user_id").eq("workspace_id", project.workspace_id).eq("role", "owner").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!owner?.user_id) return;
  await recordPlatformGrowthEvent(database, {
    eventName: input.eventName,
    userId: owner.user_id,
    workspaceId: project.workspace_id,
    metadata: { projectId: input.projectId, ...input.metadata },
    idempotencyKey: `${input.eventName}:${input.projectId}`,
  });
}
