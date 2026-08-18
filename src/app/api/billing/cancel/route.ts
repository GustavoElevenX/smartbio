import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, scheduleSubscriptionCancellation } from "@/server/billing/billing-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (_request, _context, actor) => {
  const rate = await consumeRateLimit("billing-cancel", actor.workspaceId, rateLimitRules.billingMutation, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const subscription = await scheduleSubscriptionCancellation(actor);
    return applyRateLimitHeaders(apiSuccess({
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }), rate);
  } catch (error) {
    return applyRateLimitHeaders(billingErrorResponse(error), rate);
  }
});
