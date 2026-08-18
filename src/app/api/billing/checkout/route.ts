import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, startCheckout } from "@/server/billing/billing-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (_request, _context, actor) => {
  const rate = await consumeRateLimit("billing-checkout", actor.workspaceId, rateLimitRules.billingMutation, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const session = await startCheckout(actor);
    return applyRateLimitHeaders(apiSuccess({
      clientSecret: session.clientSecret,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    }, 201), rate);
  } catch (error) {
    return applyRateLimitHeaders(billingErrorResponse(error), rate);
  }
});
