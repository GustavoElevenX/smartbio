import { createServiceClient } from "@/lib/supabase/server";
import { reservationChangeSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { getRequestId, withRequestId } from "@/server/observability/log";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  const { id } = await params;
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-reservation-cancel", publicRateLimitIdentifier(request, { objectId: id, sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => withRequestId(applyRateLimitHeaders(response, rate), requestId);
  if (!rate.allowed) return respond(apiError("Muitas solicitações.", 429, "rate_limited"));
  const parsed = reservationChangeSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  const supabase = createServiceClient();
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, status: "cancel_requested" }, 202));
  const { data, error } = await supabase.rpc("request_reservation_change", { target_reservation: id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_type: "cancel", requested_check_in: null, requested_check_out: null, request_reason: parsed.data.reason || null });
  if (error) return respond(apiError("Não foi possível solicitar o cancelamento.", 400, "cancel_request_failed"));
  const { data: reservation } = await supabase.from("reservations").select("project_id,visitor_data").eq("id", id).maybeSingle();
  if (reservation) await enqueueProjectNotification(reservation.project_id, "reservation.cancel_requested", "reservation", id, reservation.visitor_data || {}).catch(() => undefined);
  return respond(apiSuccess({ reservation: data }));
}
