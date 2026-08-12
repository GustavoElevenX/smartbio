import { z } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { composePresence } from "@/server/ai/presence-composer";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const requestSchema = z.object({
  type: z.enum(["business_site", "landing_page"]),
  instruction: z.string().max(1000).optional(),
  entryPointId: z.string().optional(),
  conversionGoalId: z.string().optional(),
  projectSnapshot: z.unknown().optional(),
});

export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const rate = await consumeRateLimit("ai-presence-generate", actor.userId, rateLimitRules.aiGeneration, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de composições atingido.", 429, "rate_limited"), rate);
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return applyRateLimitHeaders(validationError(parsed.error), rate);
  const { projectId } = await context.params;
  try {
    const result = await composePresence(actor, projectId, { requestedSurface: parsed.data.type, objective: parsed.data.instruction, campaignContext: { entryPointId: parsed.data.entryPointId, conversionGoalId: parsed.data.conversionGoalId }, projectSnapshot: parsed.data.projectSnapshot });
    return applyRateLimitHeaders(apiSuccess({ ...result, proposal: result.draft, diff: { addedSections: result.draft.sections.map((section) => section.type), removedSections: [], changedFacts: [] } }), rate);
  } catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível gerar a presença.", 400, "presence_generation_failed"), rate); }
});
