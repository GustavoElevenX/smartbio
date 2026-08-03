import { calculateQuoteEstimate } from "@/features/quotes/quote-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { quoteRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request) {
  if (!features.nativeQuotes) return apiError("Orçamentos nativos estão desativados neste ambiente.", 404, "feature_disabled");
  if (!checkRateLimit(`quote:${requestIp(request)}`, 10, 60_000)) return apiError("Muitas solicitações. Tente novamente em instantes.", 429, "rate_limited");
  const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.honeypot) return apiSuccess({ accepted: true }, 202);
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const definition = project?.commercialConfig?.quoteDefinition;
  if (!project || !definition?.isActive) return apiError("Este projeto não está recebendo orçamentos.", 404, "quote_unavailable");
  const estimate = calculateQuoteEstimate(definition, definition.rules, parsed.data.answers);
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, estimate }, 202);
  const { data, error } = await supabase.from("quote_requests").upsert({
    project_id: project.id, session_key: parsed.data.sessionId, idempotency_key: parsed.data.idempotencyKey, status: "submitted", answers: parsed.data.answers,
    estimated_min: estimate.min || null, estimated_max: estimate.max || null, currency: estimate.currency, visitor_data: parsed.data.visitorData,
  }, { onConflict: "project_id,idempotency_key" }).select("id,status,estimated_min,estimated_max,currency,created_at").single();
  if (error) { console.error("quote_request_failed", { projectId: project.id, code: error.code }); return apiError("Não foi possível enviar o orçamento.", 400, "quote_submit_failed"); }
  return apiSuccess({ accepted: true, persisted: true, request: data, estimate }, 201);
}
