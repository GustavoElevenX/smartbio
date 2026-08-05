import { createServiceClient } from "@/lib/supabase/server";
import { reservationChangeSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { checkRateLimit } from "@/server/services/rate-limit";
import { notifyProjectEvent } from "@/server/notifications/notification-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRateLimit(`reservation-change:${requestIp(request)}`, 6, 60_000)) return apiError("Muitas solicitações.", 429, "rate_limited");
  const parsed = reservationChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { id } = await params; const supabase = createServiceClient();
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, status: "cancel_requested" }, 202);
  const { data, error } = await supabase.rpc("request_reservation_change", { target_reservation: id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_type: "cancel", requested_check_in: null, requested_check_out: null, request_reason: parsed.data.reason || null });
  if (error) return apiError("Não foi possível solicitar o cancelamento.", 400, "cancel_request_failed");
  const { data: reservation } = await supabase.from("reservations").select("project_id,visitor_data").eq("id", id).maybeSingle();
  if (reservation) await notifyProjectEvent(reservation.project_id, "reservation.cancel_requested", "reservation", id, reservation.visitor_data || {}).catch(() => undefined);
  return apiSuccess({ reservation: data });
}
