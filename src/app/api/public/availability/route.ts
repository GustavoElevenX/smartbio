import { generateAvailableSlots } from "@/features/scheduling/availability-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { availabilitySearchSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";
import type { Booking } from "@/types";

export async function POST(request: Request) {
  if (!features.nativeScheduling) return apiError("Agenda nativa desativada.", 404, "feature_disabled");
  if (!checkRateLimit(`availability:${requestIp(request)}`, 30, 60_000)) return apiError("Muitas consultas de horário.", 429, "rate_limited");
  const parsed = availabilitySearchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const service = project?.commercialConfig?.schedulableServices?.find((item) => item.id === parsed.data.serviceId && item.isActive);
  if (!project || !service) return apiError("Serviço não disponível.", 404, "service_not_found");
  let bookings: Booking[] = [];
  if (supabase) {
    const dayStart = `${parsed.data.date}T00:00:00`;
    const dayEnd = `${parsed.data.date}T23:59:59`;
    const { data } = await supabase.from("bookings").select("id,project_id,session_key,service_id,resource_id,starts_at,ends_at,status,confirmation_mode,visitor_data").eq("project_id", project.id).gte("starts_at", dayStart).lte("starts_at", dayEnd);
    bookings = (data || []).map((item) => ({ id: item.id, projectId: item.project_id, sessionId: item.session_key, serviceId: item.service_id, resourceId: item.resource_id || undefined, startsAt: item.starts_at, endsAt: item.ends_at, status: item.status, confirmationMode: item.confirmation_mode, visitorData: item.visitor_data })) as Booking[];
  }
  const slots = generateAvailableSlots({ date: parsed.data.date, service, rules: project.commercialConfig?.availabilityRules || [], exceptions: project.commercialConfig?.availabilityExceptions || [], bookings, resourceId: parsed.data.resourceId });
  return apiSuccess({ slots, refreshedAt: new Date().toISOString() });
}
