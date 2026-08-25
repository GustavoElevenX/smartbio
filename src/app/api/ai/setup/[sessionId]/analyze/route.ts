import { z } from "zod";
import { setupInitialInputSchema, sourceReferenceSchema } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { logAISetupLifecycle } from "@/server/ai-setup/ai-setup-observability";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const schema = z.object({
  input: setupInitialInputSchema.optional(),
  sources: z.array(sourceReferenceSchema).max(10).optional(),
});

export const POST = withAuthenticatedActor(async (request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  const { sessionId } = await params;
  const rate = await consumeRateLimit("ai-setup-analyze", actor.userId, rateLimitRules.ai, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas análises. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const revision = schema.parse(await request.json().catch(() => ({})));
    return applyRateLimitHeaders(apiSuccess(await aiSetupService.analyze(actor, sessionId, {
      initialInput: revision.input,
      sources: revision.sources,
    })), rate);
  }
  catch (error) {
    logAISetupLifecycle("onboarding_analyze_failed", actor, sessionId, {
      code: error instanceof Error ? error.name : "unknown",
    });
    return setupApiError(error);
  }
});
