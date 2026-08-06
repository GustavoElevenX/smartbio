import { createServiceClient } from "@/lib/supabase/server";
import { bookingChangeSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-booking-reschedule", publicRateLimitIdentifier(request, { objectId: id, sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas solicitações.", 429, "rate_limited"));
  const parsed = bookingChangeSchema.refine((value) => Boolean(value.requestedStartsAt), { message: "Escolha um novo horário." }).safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  const supabase = createServiceClient();
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, status: "reschedule_requested" }, 202));
  const { data, error } = await supabase.rpc("request_booking_change", { target_booking: id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_type: "reschedule", requested_start: parsed.data.requestedStartsAt, request_reason: parsed.data.reason || null });
  if (error) return respond(apiError("Não foi possível solicitar o reagendamento.", 400, "reschedule_request_failed"));
  const { data: booking } = await supabase.from("bookings").select("project_id,visitor_data").eq("id", id).maybeSingle();
  if (booking) await enqueueProjectNotification(booking.project_id, "booking.reschedule_requested", "booking", id, { ...(booking.visitor_data || {}), date: parsed.data.requestedStartsAt }).catch(() => undefined);
  return respond(apiSuccess({ booking: data }));
}
