import { z } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, saveBillingPaymentMethod } from "@/server/billing/billing-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const schema = z.object({ paymentMethodId: z.string().regex(/^pm_[A-Za-z0-9]+$/) });

export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit("billing-payment-method", actor.workspaceId, rateLimitRules.billingMutation, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return applyRateLimitHeaders(validationError(parsed.error), rate);
  try {
    const method = await saveBillingPaymentMethod(actor, parsed.data.paymentMethodId);
    return applyRateLimitHeaders(apiSuccess({
      brand: method.brand,
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
    }), rate);
  } catch (error) {
    return applyRateLimitHeaders(billingErrorResponse(error), rate);
  }
});
