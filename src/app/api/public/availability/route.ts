import { generateAvailableSlots } from "@/features/scheduling/availability-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { availabilitySearchSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import { BookingBoundaryError, resolveSchedulingSelection } from "@/server/scheduling/booking-boundary";
import type { Booking } from "@/types";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-availability", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
  }), rateLimitRules.publicRead, { failClosed: false });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas consultas de horário.", 429, "rate_limited"));
  if (!features.nativeScheduling) return respond(apiError("Agenda nativa desativada.", 404, "feature_disabled"));
  const parsed = availabilitySearchSchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  if (!project) return respond(apiError("Serviço não disponível.", 404, "service_not_found"));
  let service;
  try {
    ({ service } = resolveSchedulingSelection(project, parsed.data.serviceId, parsed.data.resourceId));
  } catch (error) {
    if (error instanceof BookingBoundaryError) return respond(apiError(error.message, 404, error.code));
    throw error;
  }
  let bookings: Booking[] = [];
  if (supabase) {
    const day = new Date(`${parsed.data.date}T00:00:00.000Z`);
    const dayStart = new Date(day.getTime() - 86_400_000).toISOString();
    const dayEnd = new Date(day.getTime() + 172_800_000).toISOString();
    const { data } = await supabase.from("bookings").select("id,project_id,session_key,service_id,resource_id,starts_at,ends_at,status,confirmation_mode,visitor_data").eq("project_id", project.id).gte("starts_at", dayStart).lt("starts_at", dayEnd);
    bookings = (data || []).map((item) => ({ id: item.id, projectId: item.project_id, sessionId: item.session_key, serviceId: item.service_id, resourceId: item.resource_id || undefined, startsAt: item.starts_at, endsAt: item.ends_at, status: item.status, confirmationMode: item.confirmation_mode, visitorData: item.visitor_data })) as Booking[];
  }
  const slots = generateAvailableSlots({ date: parsed.data.date, service, rules: project.commercialConfig?.availabilityRules || [], exceptions: project.commercialConfig?.availabilityExceptions || [], bookings, resourceId: parsed.data.resourceId });
  return respond(apiSuccess({ slots, refreshedAt: new Date().toISOString() }));
}
