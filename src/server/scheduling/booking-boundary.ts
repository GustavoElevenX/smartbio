import { generateAvailableSlots } from "@/features/scheduling/availability-engine";
import type { Booking, Project, SchedulableResource, SchedulableService } from "@/types";

export type BookingBoundaryCode =
  | "service_not_found"
  | "resource_not_found"
  | "slot_unavailable"
  | "invalid_datetime";

export class BookingBoundaryError extends Error {
  constructor(
    public readonly code: BookingBoundaryCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingBoundaryError";
  }
}

export function resolveSchedulingSelection(
  project: Project,
  serviceId: string,
  resourceId?: string,
): { service: SchedulableService; resource?: SchedulableResource } {
  const service = project.commercialConfig?.schedulableServices?.find(
    (item) => item.id === serviceId && item.projectId === project.id && item.isActive,
  );
  if (!service) {
    throw new BookingBoundaryError("service_not_found", "Serviço não disponível.");
  }

  if (!resourceId) return { service };
  const resource = project.commercialConfig?.resources?.find(
    (item) => item.id === resourceId && item.projectId === project.id && item.isActive,
  );
  if (!resource) {
    throw new BookingBoundaryError("resource_not_found", "Recurso não disponível para este negócio.");
  }
  return { service, resource };
}

function hasExplicitOffset(value: string) {
  return /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
}

function localParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(value);
  if (!match) return null;
  return match.slice(1).map(Number) as [number, number, number, number, number, number];
}

export function zonedDateTimeToIso(value: string, timezone: string) {
  if (hasExplicitOffset(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new BookingBoundaryError("invalid_datetime", "Horário inválido.");
    return parsed.toISOString();
  }

  const parts = localParts(value);
  if (!parts) throw new BookingBoundaryError("invalid_datetime", "Horário inválido.");
  const [year, month, day, hour, minute, second] = parts;
  const desired = Date.UTC(year, month - 1, day, hour, minute, second || 0);
  let instant = desired;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let pass = 0; pass < 3; pass += 1) {
    const formatted = Object.fromEntries(
      formatter
        .formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const observed = Date.UTC(
      formatted.year,
      formatted.month - 1,
      formatted.day,
      formatted.hour,
      formatted.minute,
      formatted.second,
    );
    const correction = desired - observed;
    instant += correction;
    if (correction === 0) break;
  }

  const result = new Date(instant);
  const roundTrip = formatter.formatToParts(result);
  const roundTripParts = Object.fromEntries(
    roundTrip
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  if (
    roundTripParts.year !== year ||
    roundTripParts.month !== month ||
    roundTripParts.day !== day ||
    roundTripParts.hour !== hour ||
    roundTripParts.minute !== minute
  ) {
    throw new BookingBoundaryError("invalid_datetime", "Horário inexistente no fuso configurado.");
  }
  return result.toISOString();
}

function matchesRequestedStart(requestedStart: string, slotStart: string, timezone: string) {
  if (!hasExplicitOffset(requestedStart)) return requestedStart.slice(0, 16) === slotStart.slice(0, 16);
  return new Date(requestedStart).getTime() === new Date(zonedDateTimeToIso(slotStart, timezone)).getTime();
}

export function resolveBookingIntent(input: {
  project: Project;
  serviceId: string;
  resourceId?: string;
  startsAt: string;
  bookings?: Booking[];
}) {
  const { service, resource } = resolveSchedulingSelection(input.project, input.serviceId, input.resourceId);
  const date = input.startsAt.slice(0, 10);
  const slots = generateAvailableSlots({
    date,
    service,
    resourceId: resource?.id,
    rules: input.project.commercialConfig?.availabilityRules || [],
    exceptions: input.project.commercialConfig?.availabilityExceptions || [],
    bookings: input.bookings || [],
  });
  const slot = slots.find((candidate) => matchesRequestedStart(input.startsAt, candidate.startsAt, candidate.timezone));
  if (!slot) {
    throw new BookingBoundaryError("slot_unavailable", "Este horário não está mais disponível.");
  }

  return {
    service,
    resource,
    startsAt: zonedDateTimeToIso(slot.startsAt, slot.timezone),
    endsAt: zonedDateTimeToIso(slot.endsAt, slot.timezone),
    confirmationMode: service.confirmationMode,
    status: service.confirmationMode === "instant" ? "confirmed" as const : "pending" as const,
  };
}
