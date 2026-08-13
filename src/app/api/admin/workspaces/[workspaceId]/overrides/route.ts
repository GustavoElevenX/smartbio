import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
import { protectAdminMutation } from "@/server/platform-admin/admin-request-security";
const schema = z
  .object({
    featureKey: z.string().min(1),
    enabled: z.boolean().optional(),
    limit: z.number().int().nonnegative().optional(),
    startsAt: z.iso.datetime().optional(),
    expiresAt: z.iso.datetime().optional(),
    reason: z.string().trim().min(5).max(500),
  })
  .refine((x) => x.enabled !== undefined || x.limit !== undefined);
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/admin/workspaces/[workspaceId]/overrides">,
) {
  const admin = await requirePlatformAdmin("super_admin");
  const blocked = await protectAdminMutation(request, admin.userId);
  if (blocked) return blocked;
  const { workspaceId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const db = createServiceClient()!;
  const { data, error } = await db
    .from("workspace_entitlement_overrides")
    .insert({
      workspace_id: workspaceId,
      feature_key: parsed.data.featureKey,
      enabled_override: parsed.data.enabled,
      limit_override: parsed.data.limit,
      starts_at: parsed.data.startsAt,
      expires_at: parsed.data.expiresAt,
      reason: parsed.data.reason,
      created_by: admin.userId,
    })
    .select("*")
    .single();
  if (error)
    return apiError(
      "Não foi possível criar o override.",
      500,
      "override_failed",
    );
  await db.from("platform_admin_audit_log").insert({
    admin_user_id: admin.userId,
    admin_role: admin.role,
    workspace_id: workspaceId,
    action: "override.created",
    object_type: "workspace_entitlement_override",
    object_id: data.id,
    reason: parsed.data.reason,
    after_state: data,
  });
  return apiSuccess(data, 201);
}
