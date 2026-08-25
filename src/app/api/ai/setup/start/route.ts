import { z } from "zod";
import { setupInitialInputSchema, sourceReferenceSchema } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";

const startSchema = z.object({ input: setupInitialInputSchema, sources: z.array(sourceReferenceSchema).max(10).default([]) });

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit(
    "ai-setup-start",
    actor.userId,
    actor.persistence === "memory"
      ? { ...rateLimitRules.aiSetupStart, limit: 1_000 }
      : rateLimitRules.aiSetupStart,
    { failClosed: true },
  );
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const payload = startSchema.parse(await request.json());
    if (actor.persistence === "database")
      await recordPlatformGrowthEvent(createServiceClient()!, {
        eventName: "onboarding_started",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        idempotencyKey: `onboarding_started:${actor.userId}`,
      }).catch(() => undefined);
    return applyRateLimitHeaders(apiSuccess(await aiSetupService.start(actor, payload.input, payload.sources), 201), rate);
  } catch (error) { return setupApiError(error); }
});
