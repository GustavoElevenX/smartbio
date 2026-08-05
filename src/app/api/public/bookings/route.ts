import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";
import { notifyProjectEvent } from "@/server/notifications/notification-service";

export async function POST(request: Request) {
  if (!features.nativeScheduling) return apiError("Agenda nativa desativada.", 404, "feature_disabled");
  if (!checkRateLimit(`booking:${requestIp(request)}`, 8, 60_000)) return apiError("Muitas tentativas de agendamento.", 429, "rate_limited");
  const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.honeypot) return apiSuccess({ accepted: true }, 202);
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const service = project?.commercialConfig?.schedulableServices?.find((item) => item.id === parsed.data.serviceId && item.isActive);
  if (!project || !service) return apiError("Serviço não disponível.", 404, "service_not_found");
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, status: parsed.data.confirmationMode === "instant" ? "confirmed" : "pending" }, 202);
  const { data, error } = await supabase.rpc("create_booking_request", {
    target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey,
    target_service: parsed.data.serviceId, target_resource: parsed.data.resourceId || null, requested_start: parsed.data.startsAt, requested_end: parsed.data.endsAt,
    requested_confirmation_mode: parsed.data.confirmationMode, requested_visitor_data: parsed.data.visitorData,
  });
  if (error) { console.error("booking_submit_failed", { projectId: project.id, code: error.code }); return apiError(error.code === "P0001" ? "Este horário acabou de ser ocupado. Escolha outro." : "Não foi possível solicitar o agendamento.", 409, "booking_conflict"); }
  const bookingId = typeof data === "object" && data && "id" in data ? String(data.id) : String(data);
  await notifyProjectEvent(project.id, "booking.submitted", "booking", bookingId, { ...parsed.data.visitorData, service: service.name, date: parsed.data.startsAt }).catch(() => undefined);
  return apiSuccess({ accepted: true, persisted: true, booking: data }, 201);
}
