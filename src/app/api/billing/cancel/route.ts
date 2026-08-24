import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { billingErrorResponse, scheduleSubscriptionCancellation } from "@/server/billing/billing-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

export const feedbackSchema = z.object({ reason: z.enum(["not_using", "no_traffic", "no_result", "too_expensive", "alternative", "missing_feature", "other"]).optional(), comment: z.string().trim().max(1000).optional() });

export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit("billing-cancel", actor.workspaceId, rateLimitRules.billingMutation, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas tentativas. Aguarde um instante.", 429, "rate_limited"), rate);
  try {
    const feedback = feedbackSchema.parse(await request.json().catch(() => ({})));
    const subscription = await scheduleSubscriptionCancellation(actor);
    const database = actor.persistence === "database" ? createServiceClient() : null;
    if (database && (feedback.reason || feedback.comment)) {
      const { data: current } = await database.from("subscriptions").select("id").eq("workspace_id", actor.workspaceId).maybeSingle();
      await database.from("subscription_cancellation_feedback").insert({ workspace_id: actor.workspaceId, subscription_id: current?.id || null, user_id: actor.userId, reason: feedback.reason || null, comment: feedback.comment || null });
    }
    return applyRateLimitHeaders(apiSuccess({
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }), rate);
  } catch (error) {
    return applyRateLimitHeaders(billingErrorResponse(error), rate);
  }
});
