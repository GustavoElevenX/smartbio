import { createServiceClient } from "@/lib/supabase/server";
import { bookingChangeSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { checkRateLimit } from "@/server/services/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkRateLimit(`booking-change:${requestIp(request)}`, 6, 60_000)) return apiError("Muitas solicitações.", 429, "rate_limited");
  const parsed = bookingChangeSchema.refine((value) => Boolean(value.requestedStartsAt), { message: "Escolha um novo horário." }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const { id } = await params; const supabase = createServiceClient();
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, status: "reschedule_requested" }, 202);
  const { data, error } = await supabase.rpc("request_booking_change", { target_booking: id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, request_type: "reschedule", requested_start: parsed.data.requestedStartsAt, request_reason: parsed.data.reason || null });
  if (error) return apiError("Não foi possível solicitar o reagendamento.", 400, "reschedule_request_failed");
  return apiSuccess({ booking: data });
}
