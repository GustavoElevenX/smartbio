import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { recordPlatformGrowthEvent, type PlatformEventName } from "@/server/platform-acquisition/platform-acquisition";

const schema = z.object({
  surface: z.enum(["analytics", "optimization", "publish_readiness", "paywall", "public_preview"]),
  projectId: z.string().uuid().optional(),
});

const events: Record<z.infer<typeof schema>["surface"], PlatformEventName> = {
  analytics: "analytics_viewed",
  optimization: "optimization_viewed",
  publish_readiness: "publish_readiness_viewed",
  paywall: "paywall_viewed",
  public_preview: "first_public_preview_opened",
};

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const input = schema.parse(await request.json());
  if (actor.persistence === "memory") return apiSuccess({ recorded: false });
  const database = createServiceClient();
  if (!database) return apiSuccess({ recorded: false });
  if (input.projectId) {
    const { data } = await database.from("projects").select("id").eq("id", input.projectId).eq("workspace_id", actor.workspaceId).maybeSingle();
    if (!data) throw new Error("Projeto não encontrado.");
    const seenColumn = input.surface === "analytics" ? "last_analytics_seen_at" : input.surface === "optimization" ? "last_optimization_seen_at" : undefined;
    if (seenColumn) {
      const now = new Date().toISOString();
      const { error } = await database.from("project_member_product_state").upsert({ project_id: input.projectId, workspace_id: actor.workspaceId, user_id: actor.userId, [seenColumn]: now, updated_at: now }, { onConflict: "project_id,user_id" });
      if (error) throw error;
    }
  }
  const eventName = events[input.surface];
  await recordPlatformGrowthEvent(database, {
    eventName,
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    metadata: input.projectId ? { projectId: input.projectId } : {},
    idempotencyKey: `${eventName}:${actor.userId}:${input.projectId || actor.workspaceId}`,
  });
  if (input.surface === "paywall") {
    const { data: assignment } = await database.from("workspace_plan_assignments").select("plan_key,ends_at").eq("workspace_id", actor.workspaceId).maybeSingle();
    if (assignment?.plan_key === "trial" && assignment.ends_at && new Date(assignment.ends_at) <= new Date()) {
      await recordPlatformGrowthEvent(database, { eventName: "trial_expired", userId: actor.userId, workspaceId: actor.workspaceId, metadata: {}, idempotencyKey: `trial_expired:${actor.workspaceId}` });
    }
  }
  return apiSuccess({ recorded: true });
});
