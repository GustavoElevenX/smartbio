import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { ActivationService } from "./activation-service";
import { getActivationReadiness } from "@/features/activations/activation-readiness";
import type { CustomerHistoryCoverage } from "@/features/activations/activation.types";

export async function activationAction(context: { params: Promise<{ projectId: string; activationId: string }> }, action: "publish" | "pause" | "resume" | "end") {
  const { projectId, activationId } = await context.params;
  const actor = await requireAuthenticatedActor();
  await assertProjectAccess(actor, projectId, "write");
  const database = createServiceClient();
  const service = new ActivationService(database);
  const current = await service.get(projectId, activationId);
  if (!current) return apiError("Ativação não encontrada.", 404, "not_found");
  if (action === "publish") {
    let coverage: CustomerHistoryCoverage = { status: "virou_only", sourceCount: 0 };
    let hasValidator = false;
    if (database) {
      const [sourceRows, validatorRows] = await Promise.all([
        database.from("business_sources").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("source_purpose", "customer_history").eq("status", "processed"),
        database.from("redemption_validators").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_active", true),
      ]);
      coverage = { status: (sourceRows.count || 0) > 0 ? "historical_import" : "virou_only", sourceCount: sourceRows.count || 0 };
      hasValidator = (validatorRows.count || 0) > 0;
    }
    const readiness = getActivationReadiness(current, { coverage, hasValidator });
    if (!readiness.ready) return apiError(readiness.issues.filter((item) => item.severity === "blocking").map((item) => item.message).join(" "), 409, "activation_not_ready");
  }
  const activation = await service.action(projectId, activationId, action);
  return apiSuccess({ activation });
}
