import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
import { assignWorkspacePlan } from "@/server/entitlements/plan-service";
import { protectAdminMutation } from "@/server/platform-admin/admin-request-security";
const schema = z.object({
  planKey: z.string().min(1),
  status: z.enum(["active", "suspended", "expired"]).default("active"),
  endsAt: z.iso.datetime().optional(),
  reason: z.string().trim().min(5).max(500),
});
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/workspaces/[workspaceId]/plan">,
) {
  const admin = await requirePlatformAdmin("super_admin");
  const blocked = await protectAdminMutation(request, admin.userId);
  if (blocked) return blocked;
  const { workspaceId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const db = createServiceClient()!;
  try {
    const assignment = await assignWorkspacePlan(db, {
      workspaceId,
      planKey: parsed.data.planKey,
      status: parsed.data.status,
      endsAt: parsed.data.endsAt,
      reason: parsed.data.reason,
      actorUserId: admin.userId,
    });
    await db.from("platform_admin_audit_log").insert({
      admin_user_id: admin.userId,
      admin_role: admin.role,
      workspace_id: workspaceId,
      action: "plan.changed",
      object_type: "workspace_plan_assignment",
      object_id: workspaceId,
      reason: parsed.data.reason,
      after_state: assignment,
      request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
    });
    return apiSuccess(assignment);
  } catch {
    return apiError(
      "Não foi possível alterar o plano.",
      500,
      "plan_change_failed",
    );
  }
}
