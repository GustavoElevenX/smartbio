import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { logAISetupLifecycle } from "@/server/ai-setup/ai-setup-observability";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

export const POST = withAuthenticatedActor(async (_request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  const { sessionId } = await params;
  const rate = await consumeRateLimit("ai-setup-generate", actor.userId, rateLimitRules.aiGeneration, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas gerações. Aguarde um instante.", 429, "rate_limited"), rate);
  try { return applyRateLimitHeaders(apiSuccess(await aiSetupService.generate(actor, sessionId)), rate); }
  catch (error) {
    logAISetupLifecycle("onboarding_generate_failed", actor, sessionId, {
      code: error instanceof Error ? error.name : "unknown",
    });
    return setupApiError(error);
  }
});
