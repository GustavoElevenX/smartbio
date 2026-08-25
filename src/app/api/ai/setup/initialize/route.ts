import { z } from "zod";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  rateLimitRules,
} from "@/server/rate-limit/rate-limit";

const schema = z.object({
  idempotencyKey: z.uuid(),
  reason: z.enum(["new", "recovered", "restarted"]).default("new"),
});

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit(
    "ai-setup-initialize",
    actor.userId,
    actor.persistence === "memory"
      ? { ...rateLimitRules.aiSetupStart, limit: 1_000 }
      : rateLimitRules.aiSetupStart,
    { failClosed: true },
  );
  if (!rate.allowed)
    return applyRateLimitHeaders(
      apiError(
        "Muitas tentativas. Aguarde um instante.",
        429,
        "rate_limited",
      ),
      rate,
    );
  try {
    const input = schema.parse(await request.json());
    return applyRateLimitHeaders(
      apiSuccess(
        await aiSetupService.initialize(
          actor,
          input.idempotencyKey,
          input.reason,
        ),
        201,
      ),
      rate,
    );
  } catch (error) {
    return setupApiError(error);
  }
});
