import type { Reservation, ReservationBlock, ReservableUnit } from "@/types";

function dateOverlaps(start: string, end: string, otherStart: string, otherEnd: string) {
  return new Date(start).getTime() < new Date(otherEnd).getTime() && new Date(end).getTime() > new Date(otherStart).getTime();
}

export function reservationNights(checkIn: string, checkOut: string) {
  return Math.max(0, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
}

export function availableUnitQuantity(
  unit: ReservableUnit,
  range: { checkIn: string; checkOut: string },
  reservations: Reservation[],
  blocks: ReservationBlock[] = [],
) {
  const reserved = reservations.filter((reservation) =>
    reservation.unitId === unit.id
    && !["cancelled", "cancel_requested"].includes(reservation.status)
    && dateOverlaps(range.checkIn, range.checkOut, reservation.checkIn, reservation.checkOut),
  ).length;
  const blocked = blocks.filter((block) =>
    (!block.unitId || block.unitId === unit.id)
    && dateOverlaps(range.checkIn, range.checkOut, block.startsOn, block.endsOn),
  ).reduce((total, block) => total + block.quantity, 0);
  return Math.max(0, unit.quantity - reserved - blocked);
}

export function calculateReservationTotal(unit: ReservableUnit, checkIn: string, checkOut: string) {
  return Math.round((unit.basePrice || 0) * reservationNights(checkIn, checkOut) * 100) / 100;
}
