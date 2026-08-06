import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-booking-submit", publicRateLimitIdentifier(request, { projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined, sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : undefined }), rateLimitRules.publicFormSubmit, { failClosed: true });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas tentativas de agendamento.", 429, "rate_limited"));
  if (!features.nativeScheduling) return respond(apiError("Agenda nativa desativada.", 404, "feature_disabled"));
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  if (parsed.data.honeypot) return respond(apiSuccess({ accepted: true }, 202));
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const service = project?.commercialConfig?.schedulableServices?.find((item) => item.id === parsed.data.serviceId && item.isActive);
  if (!project || !service) return respond(apiError("Serviço não disponível.", 404, "service_not_found"));
  if (!supabase) return respond(apiSuccess({ accepted: true, persisted: false, status: parsed.data.confirmationMode === "instant" ? "confirmed" : "pending" }, 202));
  const { data, error } = await supabase.rpc("create_booking_request", {
    target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey,
    target_service: parsed.data.serviceId, target_resource: parsed.data.resourceId || null, requested_start: parsed.data.startsAt, requested_end: parsed.data.endsAt,
    requested_confirmation_mode: parsed.data.confirmationMode, requested_visitor_data: parsed.data.visitorData,
  });
  if (error) { console.error("booking_submit_failed", { projectId: project.id, code: error.code }); return respond(apiError(error.code === "P0001" ? "Este horário acabou de ser ocupado. Escolha outro." : "Não foi possível solicitar o agendamento.", 409, "booking_conflict")); }
  const bookingId = typeof data === "object" && data && "id" in data ? String(data.id) : String(data);
  await enqueueProjectNotification(project.id, "booking.submitted", "booking", bookingId, { ...parsed.data.visitorData, service: service.name, date: parsed.data.startsAt }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true, booking: data }, 201));
}
