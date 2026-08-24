import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";

const schema = z.object({ projectIds: z.array(z.string().uuid()).max(20) });

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const input = schema.parse(await request.json());
  if (actor.persistence === "memory" || !input.projectIds.length) return apiSuccess({ updated: 0 });
  const database = createServiceClient();
  if (!database) return apiSuccess({ updated: 0 });
  const { data: projects, error } = await database.from("projects").select("id").eq("workspace_id", actor.workspaceId).in("id", input.projectIds);
  if (error) throw error;
  const now = new Date().toISOString();
  const rows = (projects || []).map((project) => ({ project_id: project.id, workspace_id: actor.workspaceId, user_id: actor.userId, last_overview_seen_at: now, updated_at: now }));
  if (rows.length) {
    const { error: stateError } = await database.from("project_member_product_state").upsert(rows, { onConflict: "project_id,user_id" });
    if (stateError) throw stateError;
  }
  await recordPlatformGrowthEvent(database, { eventName: "dashboard_viewed", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { projectCount: rows.length }, idempotencyKey: `dashboard_viewed:${actor.userId}:${now.slice(0, 10)}` }).catch(() => undefined);
  return apiSuccess({ updated: rows.length });
});
