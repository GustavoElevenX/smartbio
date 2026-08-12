import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { composePresence } from "@/server/ai/presence-composer";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/ai/projects/[projectId]/presence/compose">, actor) => {
  const rate = await consumeRateLimit("ai-presence-compose", actor.userId, rateLimitRules.aiGeneration, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Limite de composições atingido.", 429, "rate_limited"), rate);
  const { projectId } = await context.params;
  try { return applyRateLimitHeaders(apiSuccess(await composePresence(actor, projectId, await request.json())), rate); }
  catch (error) { return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível compor a presença.", 400, "presence_composition_failed"), rate); }
});
