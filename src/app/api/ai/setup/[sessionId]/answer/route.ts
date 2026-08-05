import { z } from "zod";
import { aiSetupService } from "@/server/ai-setup/ai-setup-service";
import { setupApiError } from "@/server/ai-setup/setup-api";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit } from "@/server/rate-limit/rate-limit";

const answerSchema = z.object({ key: z.string().trim().min(1).max(120), value: z.union([z.string().trim().min(1).max(4000), z.array(z.string().trim().min(1).max(500)).min(1).max(30), z.number().finite(), z.boolean()]) });

export const POST = withAuthenticatedActor(async (request, { params }: { params: Promise<{ sessionId: string }> }, actor) => {
  const rate = await consumeRateLimit("ai-setup-answer", actor.userId, { limit: 40, windowMs: 60_000 }, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas respostas em sequência.", 429, "rate_limited"), rate);
  try {
    const { sessionId } = await params;
    const payload = answerSchema.parse(await request.json());
    return applyRateLimitHeaders(apiSuccess(await aiSetupService.answer(actor, sessionId, payload.key, payload.value)), rate);
  } catch (error) { return setupApiError(error); }
});
