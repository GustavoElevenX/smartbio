export const commercialNotificationEvents = [
  "lead.created",
  "quote.submitted",
  "quote.status_changed",
  "booking.submitted",
  "booking.confirmed",
  "booking.cancel_requested",
  "booking.reschedule_requested",
  "order.submitted",
  "order.status_changed",
  "reservation.submitted",
  "reservation.confirmed",
  "reservation.cancel_requested",
  "reservation.reschedule_requested",
  "source.processing_failed",
  "project.publish_blocked",
  "project.published",
] as const;

export type CommercialNotificationEvent = typeof commercialNotificationEvents[number];

export function isCommercialNotificationEvent(
  value: string,
): value is CommercialNotificationEvent {
  return (commercialNotificationEvents as readonly string[]).includes(value);
}
