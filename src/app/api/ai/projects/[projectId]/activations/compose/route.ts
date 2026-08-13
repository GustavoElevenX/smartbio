import { z } from "zod";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitRules,
} from "@/server/rate-limit/rate-limit";
import { assertProjectAccess } from "@/server/auth/project-access";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { composeActivation } from "@/server/ai/activation-composer";
import { ActivationService } from "@/server/activations/activation-service";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";
const schema = z.object({ instruction: z.string().trim().min(3).max(2000) });
export const POST = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/ai/projects/[projectId]/activations/compose">,
    actor,
  ) => {
    const rate = await consumeRateLimit(
      "ai-activation-compose",
      actor.userId,
      rateLimitRules.aiGeneration,
      { failClosed: true },
    );
    if (!rate.allowed)
      return applyRateLimitHeaders(
        apiError("Limite de composições atingido.", 429, "rate_limited"),
        rate,
      );
    const { projectId } = await context.params;
    await assertProjectAccess(actor, projectId, "write");
    const database =
      actor.persistence === "database" ? createServiceClient() : null;
    if (database)
      await requireEntitlement({
        database,
        workspaceId: actor.workspaceId,
        feature: "ai_activation",
      });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return applyRateLimitHeaders(validationError(parsed.error), rate);
    try {
      const project = await loadProjectForActor(actor, projectId);
      if (!project)
        return applyRateLimitHeaders(
          apiError(
            "Configure o banco para usar a composição por IA.",
            503,
            "database_required",
          ),
          rate,
        );
      const active = await new ActivationService(database).list(projectId);
      const draft = await composeActivation({
        workspaceId: actor.workspaceId,
        projectId,
        userId: actor.userId,
        businessProfile: project.businessProfile,
        conversionGoals: project.conversionGoals,
        catalogSummary: (project.commercialConfig?.catalogItems || []).map(
          ({ id, name, price }) => ({ id, name, price }),
        ),
        serviceSummary: (project.commercialConfig?.serviceOfferings || []).map(
          ({ id, name }) => ({ id, name }),
        ),
        locations: (project.commercialConfig?.locations || []).map(
          ({ id, name }) => ({ id, name }),
        ),
        presencePages: (project.presence?.pages || []).map(({ id, name }) => ({
          id,
          name,
        })),
        activeActivations: active.filter((item) =>
          ["active", "scheduled"].includes(item.status),
        ),
        instruction: parsed.data.instruction,
      });
      return applyRateLimitHeaders(apiSuccess({ draft }), rate);
    } catch (error) {
      return applyRateLimitHeaders(
        apiError(
          error instanceof Error
            ? error.message
            : "Não foi possível compor a ativação.",
          400,
          "activation_composition_failed",
        ),
        rate,
      );
    }
  },
);
