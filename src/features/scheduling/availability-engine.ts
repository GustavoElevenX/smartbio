import type { AvailabilityException, AvailabilityRule, Booking, SchedulableService } from "@/types";

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
  resourceId?: string;
  timezone: string;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function timeLabel(totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minute = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

export function hasBookingConflict(candidate: Pick<Booking, "startsAt" | "endsAt" | "resourceId">, bookings: Booking[]) {
  return bookings.some((booking) =>
    !["cancelled", "cancel_requested", "no_show"].includes(booking.status)
    && (!candidate.resourceId || !booking.resourceId || candidate.resourceId === booking.resourceId)
    && overlaps(candidate.startsAt, candidate.endsAt, booking.startsAt, booking.endsAt),
  );
}

export function generateAvailableSlots(input: {
  date: string;
  service: SchedulableService;
  rules: AvailabilityRule[];
  exceptions?: AvailabilityException[];
  bookings?: Booking[];
  resourceId?: string;
  intervalMinutes?: number;
}): AvailableSlot[] {
  const weekday = new Date(`${input.date}T12:00:00Z`).getUTCDay();
  const rules = input.rules.filter((rule) => rule.weekday === weekday && (!input.resourceId || !rule.resourceId || rule.resourceId === input.resourceId));
  const exceptions = input.exceptions || [];
  const bookings = input.bookings || [];
  const interval = input.intervalMinutes || 30;
  const slots: AvailableSlot[] = [];

  for (const rule of rules) {
    const start = minutes(rule.startTime);
    const end = minutes(rule.endTime);
    const occupiedMinutes = input.service.durationMinutes + input.service.bufferBeforeMinutes + input.service.bufferAfterMinutes;
    for (let cursor = start; cursor + occupiedMinutes <= end; cursor += interval) {
      const startsAt = `${input.date}T${timeLabel(cursor + input.service.bufferBeforeMinutes)}:00`;
      const endsAt = `${input.date}T${timeLabel(cursor + input.service.bufferBeforeMinutes + input.service.durationMinutes)}:00`;
      const blocked = exceptions.some((exception) =>
        !exception.isAvailable
        && (!input.resourceId || !exception.resourceId || input.resourceId === exception.resourceId)
        && overlaps(startsAt, endsAt, exception.startsAt, exception.endsAt),
      );
      const conflict = hasBookingConflict({ startsAt, endsAt, resourceId: input.resourceId }, bookings);
      if (!blocked && !conflict) slots.push({ startsAt, endsAt, resourceId: input.resourceId, timezone: rule.timezone });
    }
  }
  return slots;
}
