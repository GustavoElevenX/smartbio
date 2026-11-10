import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { ActivationService } from "./activation-service";
import { getActivationReadiness } from "@/features/activations/activation-readiness";
import type { CustomerHistoryCoverage } from "@/features/activations/activation.types";
import { getCustomerHistoryCoverage } from "@/server/customer-identity/customer-history-coverage";
import { requireResourceCapacity } from "@/server/entitlements/require-entitlement";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { activationDynamicSurfaceSchema } from "@/features/activations/dynamic-home-contract";
import { findDemoProject } from "@/data/demo-projects";

export async function activationAction(context: { params: Promise<{ projectId: string; activationId: string }> }, action: "publish" | "pause" | "resume" | "end", request?: Request) {
  const { projectId, activationId } = await context.params;
  const actor = await requireAuthenticatedActor();
  await assertProjectAccess(actor, projectId, "write");
  const database = actor.persistence === "database" ? createServiceClient() : null;
  const service = new ActivationService(database);
  const current = await service.get(projectId, activationId);
  if (!current) return apiError("Ativação não encontrada.", 404, "not_found");
  if (action === "publish") {
    const dynamicSurface = current.settings.dynamicSurface;
    const project = dynamicSurface ? await loadProjectForActor(actor, projectId) ||
      (actor.persistence === "memory" ? findDemoProject(projectId) : null) : null;
    if (dynamicSurface) {
      if (!project) return apiError("Negócio não encontrado.", 404, "project_not_found");
      const review = await request?.json().catch(() => null) as { confirmed?: boolean; reviewedVersion?: number } | null | undefined;
      if (review?.confirmed !== true || review.reviewedVersion !== current.version) {
        return apiError("Revise e confirme esta versão da campanha antes de publicar.", 409, "review_required");
      }
      const parsed = activationDynamicSurfaceSchema.safeParse(dynamicSurface);
      if (!parsed.success || parsed.data.conversionGoalId !== current.conversionGoalId || parsed.data.experienceKey !== current.activationKey) {
        return apiError("Revise a página e a meta da campanha antes de publicar.", 409, "invalid_campaign_surface");
      }
    }
    if (dynamicSurface) {
      try { new Intl.DateTimeFormat("pt-BR", { timeZone: current.timezone }); } catch {
        return apiError("O fuso horário da campanha é inválido.", 409, "invalid_timezone");
      }
      const destinations = project!.commercialConfig?.routingDestinations || [];
      if (current.defaultDestinationId && !destinations.some((item) => item.id === current.defaultDestinationId)) {
        return apiError("O destino comercial da campanha não existe mais.", 409, "invalid_destination");
      }
    }
    if(database)await requireResourceCapacity({database,workspaceId:actor.workspaceId,feature:"active_activations"});
    let coverage: CustomerHistoryCoverage = { status: "virou_only", sourceCount: 0, importedCustomerCount: 0, successfulBatchCount: 0 };
    let hasValidator = false;
    if (database) {
      const [resolvedCoverage, validatorRows] = await Promise.all([
        getCustomerHistoryCoverage(database, projectId),
        database.from("redemption_validators").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("is_active", true),
      ]);
      coverage = resolvedCoverage;
      hasValidator = (validatorRows.count || 0) > 0;
    }
    const destinations = project?.commercialConfig?.routingDestinations || [];
    const readiness = getActivationReadiness(current, { coverage, hasValidator,
      validGoalIds: project ? (project.conversionGoals || []).filter((item) => item.isActive).map((item) => item.id) : undefined,
      validLocationIds: project ? (project.commercialConfig?.locations || []).filter((item) => item.isActive).map((item) => item.id) : undefined,
      validPageIds: project ? (project.presence?.pages || []).filter((item) => item.isActive).map((item) => item.id) : undefined,
      hasRoutingFallback: project ? destinations.some((item) => item.isDefault) : undefined,
      hasGoalDefaultDestination: project ? destinations.some((item) => item.isDefault) : undefined,
    });
    if (!readiness.ready) return apiError(readiness.issues.filter((item) => item.severity === "blocking").map((item) => item.message).join(" "), 409, "activation_not_ready");
  }
  try { return apiSuccess({ activation: await service.action(projectId, activationId, action) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível atualizar a campanha.", 409, "activation_action_failed"); }
}
