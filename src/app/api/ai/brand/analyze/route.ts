import { z } from "zod";
import { analyzeAndStoreBrandLogo } from "@/server/brand/brand-logo-service";
import { EntitlementError } from "@/server/entitlements/entitlement-types";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

export const runtime = "nodejs";

const contextSchema = z.object({
  businessName: z.string().trim().max(160).optional(),
  businessDescription: z.string().trim().max(4000).optional(),
});

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit("brand-logo-analyze", actor.workspaceId, rateLimitRules.ai, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitas análises de marca. Tente novamente em instantes.", 429, "rate_limited"), rate);
  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File)) return applyRateLimitHeaders(apiError("Selecione uma logo válida.", 422, "invalid_logo"), rate);
  const context = contextSchema.safeParse({
    businessName: form.get("businessName") || undefined,
    businessDescription: form.get("businessDescription") || undefined,
  });
  if (!context.success) return applyRateLimitHeaders(apiError("Os dados da marca não são válidos.", 422, "invalid_brand_context"), rate);
  try {
    return applyRateLimitHeaders(apiSuccess(await analyzeAndStoreBrandLogo(actor, file, context.data), 201), rate);
  } catch (error) {
    if (error instanceof EntitlementError) throw error;
    return applyRateLimitHeaders(apiError(error instanceof Error ? error.message : "Não foi possível analisar a logo.", 400, "brand_logo_analysis_failed"), rate);
  }
});
