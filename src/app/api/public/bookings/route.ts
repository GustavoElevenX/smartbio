import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { enqueueProjectNotification } from "@/server/notifications/notification-service";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { registerOpportunity } from "@/server/opportunities/service";
import { BookingBoundaryError, resolveBookingIntent } from "@/server/scheduling/booking-boundary";
import type { Booking } from "@/types";

function bookingRows(data: Array<Record<string, unknown>> | null): Booking[] {
  return (data || []).map((item) => ({
    id: String(item.id),
    projectId: String(item.project_id),
    sessionId: String(item.session_key),
    serviceId: String(item.service_id),
    resourceId: item.resource_id ? String(item.resource_id) : undefined,
    startsAt: String(item.starts_at),
    endsAt: String(item.ends_at),
    status: item.status as Booking["status"],
    confirmationMode: item.confirmation_mode as Booking["confirmationMode"],
    visitorData: {},
  }));
}

function boundaryError(error: BookingBoundaryError) {
  const status = error.code === "slot_unavailable" ? 409 : 404;
  return apiError(error.message, status, error.code);
}

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
  if (!project) return respond(apiError("Serviço não disponível.", 404, "service_not_found"));

  let bookings: Booking[] = [];
  if (supabase) {
    const requestedDay = new Date(`${parsed.data.startsAt.slice(0, 10)}T00:00:00.000Z`);
    const rangeStart = new Date(requestedDay.getTime() - 86_400_000).toISOString();
    const rangeEnd = new Date(requestedDay.getTime() + 172_800_000).toISOString();
    const { data, error } = await supabase
      .from("bookings")
      .select("id,project_id,session_key,service_id,resource_id,starts_at,ends_at,status,confirmation_mode")
      .eq("project_id", project.id)
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd);
    if (error) return respond(apiError("Não foi possível validar a disponibilidade.", 503, "availability_check_failed"));
    bookings = bookingRows(data as Array<Record<string, unknown>> | null);
  }

  let decision: ReturnType<typeof resolveBookingIntent>;
  try {
    decision = resolveBookingIntent({
      project,
      serviceId: parsed.data.serviceId,
      resourceId: parsed.data.resourceId,
      startsAt: parsed.data.startsAt,
      bookings,
    });
  } catch (error) {
    if (error instanceof BookingBoundaryError) return respond(boundaryError(error));
    throw error;
  }

  if (!supabase) {
    return respond(apiSuccess({
      accepted: true,
      persisted: false,
      booking: {
        startsAt: decision.startsAt,
        endsAt: decision.endsAt,
        status: decision.status,
        confirmationMode: decision.confirmationMode,
        resourceId: decision.resource?.id,
      },
    }, 202));
  }
  const { data, error } = await supabase.rpc("create_booking_request", {
    target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey,
    target_service: decision.service.id, target_resource: decision.resource?.id || null, requested_start: decision.startsAt,
    requested_visitor_data: parsed.data.visitorData,
  });
  if (error) {
    const known = {
      P0001: ["Este horário acabou de ser ocupado. Escolha outro.", "booking_conflict"],
      P0002: ["Serviço não disponível.", "service_not_found"],
      P0003: ["Recurso não disponível para este serviço.", "resource_not_found"],
      P0004: ["Este horário não está mais disponível.", "slot_unavailable"],
      P0005: ["Esta chave de envio já foi usada para outro agendamento.", "idempotency_conflict"],
    } as const;
    const mapped = known[error.code as keyof typeof known];
    console.error("booking_submit_failed", { projectId: project.id, code: error.code });
    return respond(apiError(mapped?.[0] || "Não foi possível solicitar o agendamento.", error.code === "P0002" || error.code === "P0003" ? 404 : 409, mapped?.[1] || "booking_rejected"));
  }
  const row = Array.isArray(data) ? data[0] : data;
  const bookingId = typeof row === "object" && row && "id" in row ? String(row.id) : String(row);
  const publicBooking = typeof row === "object" && row ? {
    id: bookingId,
    resourceId: "resource_id" in row && row.resource_id ? String(row.resource_id) : undefined,
    startsAt: "starts_at" in row ? String(row.starts_at) : decision.startsAt,
    endsAt: "ends_at" in row ? String(row.ends_at) : decision.endsAt,
    status: "status" in row ? String(row.status) : decision.status,
    confirmationMode: "confirmation_mode" in row ? String(row.confirmation_mode) : decision.confirmationMode,
  } : { id: bookingId, startsAt: decision.startsAt, endsAt: decision.endsAt, status: decision.status, confirmationMode: decision.confirmationMode };
  const opportunity = await registerOpportunity(supabase, { workspaceId: project.workspaceId, projectId: project.id, projectName: project.name, sessionId: parsed.data.sessionId, sourceType: "booking", sourceId: bookingId, title: `Agendamento · ${decision.service.name}`, conversionGoalId: parsed.data.conversionGoalId, entryPointId: parsed.data.entryPointId, attribution: parsed.data.attribution, visitorData: parsed.data.visitorData, summary: publicBooking.startsAt }).catch(() => null);
  await enqueueProjectNotification(project.id, "booking.submitted", "opportunity", opportunity?.id || bookingId, { ...parsed.data.visitorData, service: decision.service.name, date: publicBooking.startsAt }).catch(() => undefined);
  return respond(apiSuccess({ accepted: true, persisted: true, booking: publicBooking }, 201));
}
