import { z } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { composePresence } from "@/server/ai/presence-composer";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const requestSchema = z.object({ instruction: z.string().max(1000).optional(), projectSnapshot: z.unknown().optional() });
export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string; pageId: string }> }, actor) => {
  const rate = await consumeRateLimit("ai-presence-regenerate", actor.userId, rateLimitRules.aiGeneration, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de composições atingido.", 429, "rate_limited"), rate);
  const parsed = requestSchema.safeParse(await request.json()); if (!parsed.success) return validationError(parsed.error);
  const { projectId, pageId } = await context.params;
  try { const result = await composePresence(actor, projectId, { requestedSurface: "business_site", objective: `Recomponha somente a página ${pageId}. ${parsed.data.instruction || ""}`.trim(), projectSnapshot: parsed.data.projectSnapshot }); return applyRateLimitHeaders(apiSuccess({ ...result, targetPageId: pageId, proposal: result.draft, diff: { reviewRequired: true, autoApplied: false } }), rate); }
  catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível recompor a página.", 400, "presence_regeneration_failed"), rate); }
});
