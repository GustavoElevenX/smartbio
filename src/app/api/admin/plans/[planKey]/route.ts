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
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  displayPrice: z.number().nonnegative().nullable().optional(),
  entitlements: z
    .array(
      z.object({
        featureKey: z.string().min(1),
        enabled: z.boolean(),
        limit: z.number().int().nonnegative().nullable(),
      }),
    )
    .max(100)
    .optional(),
  reason: z.string().trim().min(5).max(500),
});
interface AdminPlanRouteContext { params: Promise<{ planKey: string }> }
export async function PATCH(
  request: Request,
  { params }: AdminPlanRouteContext,
) {
  const admin = await requirePlatformAdmin("super_admin"),
    blocked = await protectAdminMutation(request, admin.userId);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { planKey } = await params,
    db = createServiceClient()!;
  const { data: before } = await db
    .from("plan_catalog")
    .select("*,plan_entitlements(*)")
    .eq("plan_key", planKey)
    .maybeSingle();
  if (!before) return apiError("Plano não encontrado.", 404, "plan_not_found");
  const planPatch = {
    name: parsed.data.name,
    description: parsed.data.description,
    is_public: parsed.data.isPublic,
    is_active: parsed.data.isActive,
    display_price: parsed.data.displayPrice,
  };
  const { error } = await db
    .from("plan_catalog")
    .update(planPatch)
    .eq("plan_key", planKey);
  if (error)
    return apiError(
      "Não foi possível salvar o plano.",
      500,
      "plan_update_failed",
    );
  if (parsed.data.entitlements?.length) {
    const { error: entitlementError } = await db
      .from("plan_entitlements")
      .upsert(
        parsed.data.entitlements.map((item) => ({
          plan_key: planKey,
          feature_key: item.featureKey,
          enabled: item.enabled,
          limit_value: item.limit,
        })),
        { onConflict: "plan_key,feature_key" },
      );
    if (entitlementError)
      return apiError(
        "Não foi possível salvar os recursos.",
        500,
        "plan_entitlements_failed",
      );
  }
  const { data: after } = await db
    .from("plan_catalog")
    .select("*,plan_entitlements(*)")
    .eq("plan_key", planKey)
    .single();
  await db
    .from("platform_admin_audit_log")
    .insert({
      admin_user_id: admin.userId,
      admin_role: admin.role,
      action: "plan_catalog.updated",
      object_type: "plan",
      object_id: planKey,
      reason: parsed.data.reason,
      before_state: before,
      after_state: after,
      request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
    });
  return apiSuccess(after);
}
