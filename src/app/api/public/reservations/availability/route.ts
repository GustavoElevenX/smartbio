import { availableUnitQuantity, calculateReservationTotal } from "@/features/reservations/reservation-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { reservationAvailabilitySchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRateLimitIdentifier } from "@/server/rate-limit/public-identifier";
import type { Reservation, ReservationBlock } from "@/types";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const candidate = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const rate = await consumeRateLimit("public-reservation-availability", publicRateLimitIdentifier(request, {
    projectId: typeof candidate.projectId === "string" ? candidate.projectId : undefined,
  }), rateLimitRules.publicRead, { failClosed: false });
  const respond = <T extends Response>(response: T) => applyRateLimitHeaders(response, rate);
  if (!rate.allowed) return respond(apiError("Muitas consultas de disponibilidade.", 429, "rate_limited"));
  if (!features.nativeReservations) return respond(apiError("Reservas nativas estão desativadas.", 404, "feature_disabled"));
  const parsed = reservationAvailabilitySchema.safeParse(raw);
  if (!parsed.success) return respond(validationError(parsed.error));
  const supabase = createServiceClient();
  const project = await getPublicProjectById(supabase, parsed.data.projectId);
  if (!project) return respond(apiError("Projeto não encontrado.", 404, "project_not_found"));
  let reservations: Reservation[] = []; let blocks: ReservationBlock[] = project.commercialConfig?.reservationBlocks || [];
  if (supabase) {
    const [reservationResult, blockResult] = await Promise.all([
      supabase.from("reservations").select("id,project_id,session_key,unit_id,check_in,check_out,adults,children,status,total,deposit_amount,visitor_data").eq("project_id", project.id).lt("check_in", parsed.data.checkOut).gt("check_out", parsed.data.checkIn),
      supabase.from("reservation_blocks").select("id,project_id,unit_id,starts_on,ends_on,quantity,reason").eq("project_id", project.id).lt("starts_on", parsed.data.checkOut).gt("ends_on", parsed.data.checkIn),
    ]);
    reservations = (reservationResult.data || []).map((item) => ({ id: item.id, projectId: item.project_id, sessionId: item.session_key, unitId: item.unit_id, checkIn: item.check_in, checkOut: item.check_out, adults: item.adults, children: item.children, status: item.status, total: item.total || undefined, depositAmount: item.deposit_amount || undefined, visitorData: item.visitor_data })) as Reservation[];
    blocks = (blockResult.data || []).map((item) => ({ id: item.id, projectId: item.project_id, unitId: item.unit_id || undefined, startsOn: item.starts_on, endsOn: item.ends_on, quantity: item.quantity, reason: item.reason || undefined }));
  }
  const units = (project.commercialConfig?.reservableUnits || []).filter((unit) => unit.isActive && unit.capacityAdults >= parsed.data.adults && unit.capacityChildren >= parsed.data.children).map((unit) => ({ ...unit, availableQuantity: availableUnitQuantity(unit, parsed.data, reservations, blocks), total: calculateReservationTotal(unit, parsed.data.checkIn, parsed.data.checkOut) })).filter((unit) => unit.availableQuantity > 0);
  return respond(apiSuccess({ units, refreshedAt: new Date().toISOString() }));
}
