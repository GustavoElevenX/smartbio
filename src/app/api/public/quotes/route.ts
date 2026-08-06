import { calculateQuoteEstimate } from "@/features/quotes/quote-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { quoteRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-quote-submit", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
    sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined,
  }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas solicitações. Tente novamente em instantes.", 429, "rate_limited"));
  if (!features.nativeQuotes) return respond(apiError("Orçamentos nativos estão desativados neste ambiente.", 404, "feature_disabled"));
  const parsed = quoteRequestSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  if (parsed.data.honeypot) return respond(apiSuccess({ accepted: true }, 202));
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const definition = project?.commercialConfig?.quoteDefinition;
  if (!project || !definition?.isActive) return respond(apiError("Este projeto não está recebendo orçamentos.", 404, "quote_unavailable"));
  const estimate = calculateQuoteEstimate(definition, definition.rules, parsed.data.answers);
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, estimate }, 202));
  const { data, error } = await supabase.from("quote_requests").upsert({
    project_id: project.id, session_key: parsed.data.sessionId, idempotency_key: parsed.data.idempotencyKey, status: "submitted", answers: parsed.data.answers,
    estimated_min: estimate.min || null, estimated_max: estimate.max || null, currency: estimate.currency, visitor_data: parsed.data.visitorData,
  }, { onConflict: "project_id,idempotency_key" }).select("id,status,estimated_min,estimated_max,currency,created_at").single();
  if (error) { console.error("quote_request_failed", { projectId: project.id, code: error.code }); return respond(apiError("Não foi possível enviar o orçamento.", 400, "quote_submit_failed")); }
  await enqueueProjectNotification(project.id, "quote.submitted", "quote", data.id, { ...parsed.data.visitorData, interest: definition.title }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true, request: data, estimate }, 201));
}
