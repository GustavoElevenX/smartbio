import { availableUnitQuantity, calculateReservationTotal } from "@/features/reservations/reservation-engine";
import { features } from "@/lib/constants";
import { createServiceClient } from "@/lib/supabase/server";
import { reservationRequestSchema } from "@/lib/validation/schemas";
import { apiError, apiSuccess, requestIp, validationError } from "@/server/http/api-response";
import { getPublicProjectById } from "@/server/repositories/public-commercial-repository";
import { checkRateLimit } from "@/server/services/rate-limit";
import type { Reservation, ReservationBlock } from "@/types";

export async function POST(request: Request) {
  if (!features.nativeReservations) return apiError("Reservas nativas estão desativadas.", 404, "feature_disabled");
  if (!checkRateLimit(`reservation:${requestIp(request)}`, 8, 60_000)) return apiError("Muitas tentativas de reserva.", 429, "rate_limited");
  const parsed = reservationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (parsed.data.honeypot) return apiSuccess({ accepted: true }, 202);
  const supabase = createServiceClient(); const project = await getPublicProjectById(supabase, parsed.data.projectId);
  const unit = project?.commercialConfig?.reservableUnits?.find((item) => item.id === parsed.data.unitId && item.isActive);
  if (!project || !unit || unit.capacityAdults < parsed.data.adults || unit.capacityChildren < parsed.data.children) return apiError("A opção escolhida não está disponível para este grupo.", 409, "unit_unavailable");
  const total = calculateReservationTotal(unit, parsed.data.checkIn, parsed.data.checkOut); const depositAmount = project.commercialConfig?.paymentUrl ? Math.round(total * 0.3 * 100) / 100 : undefined;
  if (!supabase) return apiSuccess({ accepted: true, persisted: false, reservation: { ...parsed.data, total, depositAmount, status: project.businessProfile?.confirmationMode === "instant" ? "confirmed" : "pending" } }, 202);
  const { data: reservationRows } = await supabase.from("reservations").select("id,project_id,session_key,unit_id,check_in,check_out,adults,children,status,total,deposit_amount,visitor_data").eq("project_id", project.id).eq("unit_id", unit.id).lt("check_in", parsed.data.checkOut).gt("check_out", parsed.data.checkIn);
  const { data: blockRows } = await supabase.from("reservation_blocks").select("id,project_id,unit_id,starts_on,ends_on,quantity,reason").eq("project_id", project.id).or(`unit_id.is.null,unit_id.eq.${unit.id}`).lt("starts_on", parsed.data.checkOut).gt("ends_on", parsed.data.checkIn);
  const reservations = (reservationRows || []).map((item) => ({ id: item.id, projectId: item.project_id, sessionId: item.session_key, unitId: item.unit_id, checkIn: item.check_in, checkOut: item.check_out, adults: item.adults, children: item.children, status: item.status, total: item.total || undefined, depositAmount: item.deposit_amount || undefined, visitorData: item.visitor_data })) as Reservation[];
  const blocks = (blockRows || []).map((item) => ({ id: item.id, projectId: item.project_id, unitId: item.unit_id || undefined, startsOn: item.starts_on, endsOn: item.ends_on, quantity: item.quantity, reason: item.reason || undefined })) as ReservationBlock[];
  if (availableUnitQuantity(unit, parsed.data, reservations, blocks) <= 0) return apiError("Esta opção acabou de ficar indisponível. Consulte outras datas.", 409, "reservation_conflict");
  const { data, error } = await supabase.rpc("create_reservation_request", { target_project: project.id, request_session_key: parsed.data.sessionId, request_idempotency_key: parsed.data.idempotencyKey, target_unit: unit.id, requested_check_in: parsed.data.checkIn, requested_check_out: parsed.data.checkOut, requested_adults: parsed.data.adults, requested_children: parsed.data.children, requested_total: total, requested_deposit: depositAmount || null, requested_visitor_data: parsed.data.visitorData });
  if (error) { console.error("reservation_submit_failed", { projectId: project.id, code: error.code }); return apiError("A disponibilidade mudou. Consulte novamente.", 409, "reservation_conflict"); }
  return apiSuccess({ accepted: true, persisted: true, reservation: data }, 201);
}
