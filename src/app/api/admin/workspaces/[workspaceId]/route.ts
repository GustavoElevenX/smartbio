import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
import { protectAdminMutation } from "@/server/platform-admin/admin-request-security";
const schema = z.object({
  accountStatus: z.enum(["active", "suspended"]),
  reason: z.string().trim().min(5).max(500),
});
interface AdminWorkspaceRouteContext { params: Promise<{ workspaceId: string }> }
export async function PATCH(
  request: Request,
  { params }: AdminWorkspaceRouteContext,
) {
  const admin = await requirePlatformAdmin("super_admin"),
    blocked = await protectAdminMutation(request, admin.userId);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { workspaceId } = await params,
    db = createServiceClient()!;
  const { data: before } = await db
    .from("workspaces")
    .select("account_status")
    .eq("id", workspaceId)
    .maybeSingle();
  const { data, error } = await db
    .from("workspaces")
    .update({ account_status: parsed.data.accountStatus })
    .eq("id", workspaceId)
    .select("id,account_status")
    .single();
  if (error)
    return apiError(
      "Não foi possível alterar o workspace.",
      500,
      "workspace_status_failed",
    );
  await db
    .from("platform_admin_audit_log")
    .insert({
      admin_user_id: admin.userId,
      admin_role: admin.role,
      workspace_id: workspaceId,
      action: "workspace.status_changed",
      object_type: "workspace",
      object_id: workspaceId,
      reason: parsed.data.reason,
      before_state: before,
      after_state: data,
      request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
    });
  return apiSuccess(data);
}
