import { z } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { composePresence } from "@/server/ai/presence-composer";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const requestSchema = z.object({ scope: z.enum(["copy", "structure", "cta", "visual"]), instruction: z.string().max(1000).optional(), sectionType: z.string().optional(), projectSnapshot: z.unknown().optional() });
export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string; sectionId: string }> }, actor) => {
  const rate = await consumeRateLimit("ai-presence-section-improve", actor.userId, rateLimitRules.aiGeneration, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de composições atingido.", 429, "rate_limited"), rate);
  const parsed = requestSchema.safeParse(await request.json()); if (!parsed.success) return validationError(parsed.error);
  const { projectId, sectionId } = await context.params;
  try { const result = await composePresence(actor, projectId, { requestedSurface: "business_site", objective: `Sugira uma melhoria de ${parsed.data.scope} para a seção ${sectionId}${parsed.data.sectionType ? ` do tipo ${parsed.data.sectionType}` : ""}. Preserve fatos verificados. ${parsed.data.instruction || ""}`.trim(), projectSnapshot: parsed.data.projectSnapshot }); return applyRateLimitHeaders(apiSuccess({ ...result, targetSectionId: sectionId, scope: parsed.data.scope, proposal: result.draft, diff: { reviewRequired: true, verifiedFactsChanged: false, autoApplied: false } }), rate); }
  catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível melhorar a seção.", 400, "presence_section_improvement_failed"), rate); }
});
