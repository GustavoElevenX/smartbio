export const OPTIMIZATION_THRESHOLDS = {
  completeDays: 30,
  projectSessions: 30,
  goalSessions: 15,
  comparisonEntrySessions: 30,
  journeyStepViews: 30,
  presenceViews: 30,
  minimumMeaningfulAbsoluteDelta: 0.02,
  neutralBand: 0.01,
} as const;

export const ACTION_EVENT_NAMES = [
  "form_submitted",
  "quote_submitted",
  "booking_submitted",
  "order_submitted",
  "reservation_submitted",
  "route_resolved",
  "whatsapp_clicked",
  "external_link_clicked",
] as const;
