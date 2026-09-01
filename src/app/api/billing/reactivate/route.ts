import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, reactivateSubscription } from "@/server/billing/billing-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { getRequestId, requestPathname } from "@/server/observability/log";

export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit("billing-reactivate", actor.workspaceId, rateLimitRules.billingMutation, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const subscription = await reactivateSubscription(actor);
    return applyRateLimitHeaders(apiSuccess({
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }), rate);
  } catch (error) {
    return applyRateLimitHeaders(billingErrorResponse(error, { requestId: getRequestId(request), route: requestPathname(request), workspaceId: actor.workspaceId, userId: actor.userId }), rate);
  }
});
