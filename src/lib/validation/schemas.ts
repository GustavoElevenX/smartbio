import { z } from "zod";

export const safeText = z.string().trim().max(500).transform((value) => value.replace(/[<>]/g, ""));
const shortId = z.string().trim().min(1).max(150);
const idempotencyKey = z.string().trim().min(12).max(180);
const visitorData = z.record(z.string().max(80), z.union([z.string().max(1000), z.number().finite(), z.boolean()]));
const answers = z.record(z.string().max(80), z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.array(z.string().max(500)).max(20)]));
const conversionContext = {
  conversionGoalId: shortId.optional(), entryPointId: shortId.optional(), destinationId: shortId.optional(), presencePageId: shortId.optional(), presenceSectionId: shortId.optional(),
  activationId: z.string().uuid().optional(), benefitClaimId: z.string().uuid().optional(),
  attribution: z.object({ entryPointId: shortId.optional(), conversionGoalId: shortId.optional(), presencePageId: shortId.optional(), presenceSectionId: shortId.optional(), activationId: z.string().uuid().optional(), benefitClaimId: z.string().uuid().optional(), source: safeText, medium: safeText.optional(), campaign: safeText.optional(), content: safeText.optional(), term: safeText.optional(), referrer: z.string().url().max(1000).optional() }).optional(),
};

export const publicAnalyticsEventNames = [
  "page_view", "session_started", "step_viewed", "option_clicked", "form_started", "form_submitted", "recommendation_viewed", "cta_clicked", "whatsapp_clicked", "external_link_clicked", "journey_completed",
  "journey_started", "journey_answered", "journey_context_completed", "location_selected", "route_unresolved", "handoff_built", "external_url_clicked",
  "capability_started", "qualification_completed", "quote_started", "quote_submitted", "quote_estimate_viewed", "media_uploaded", "availability_searched", "slot_selected", "booking_submitted", "booking_cancel_requested", "catalog_viewed", "item_viewed", "item_added", "cart_viewed", "order_submitted", "reservation_search_started", "reservation_option_viewed", "reservation_submitted", "reservation_cancel_requested", "route_resolved", "payment_started",
  "entry_point_loaded", "conversion_goal_selected", "conversion_goal_resolved",
  "presence_page_viewed", "presence_section_viewed", "presence_cta_clicked", "presence_conversion_started",
  "activation_viewed", "activation_cta_clicked", "activation_started",
] as const;

export const serverAnalyticsEventNames = [
  "lead_captured", "booking_confirmed", "reservation_confirmed",
  "opportunity_created", "conversion_confirmed", "conversion_lost",
  "customer_identified", "benefit_eligibility_checked", "benefit_claim_issued", "benefit_claim_presented", "benefit_claim_redeemed", "benefit_claim_rejected", "activation_opportunity_created",
] as const;

export const analyticsEventNames = [
  ...publicAnalyticsEventNames,
  ...serverAnalyticsEventNames,
] as const;

export type PublicAnalyticsEventName = (typeof publicAnalyticsEventNames)[number];
export type ServerAnalyticsEventName = (typeof serverAnalyticsEventNames)[number];

export const publicAnalyticsEventSchema = z.object({
  projectId: shortId, visitorId: shortId, sessionId: shortId,
  idempotencyKey: z.string().trim().min(12).max(180).optional(),
  eventName: z.enum(publicAnalyticsEventNames),
  stepId: shortId.optional(), optionId: shortId.optional(), conversionGoalId: shortId.optional(), entryPointId: shortId.optional(), destinationId: shortId.optional(), presencePageId: shortId.optional(), presenceSectionId: shortId.optional(), activationId: z.string().uuid().optional(), benefitClaimId: z.string().uuid().optional(), metadata: z.record(z.string().max(80), z.unknown()).optional(), referrer: z.string().url().max(1000).or(z.literal("")).optional(),
  utmSource: safeText.optional(), utmMedium: safeText.optional(), utmCampaign: safeText.optional(), utmContent: safeText.optional(), utmTerm: safeText.optional(), deviceType: z.enum(["mobile", "desktop", "tablet"]).optional(),
});

// Internal consumers may parse the complete event vocabulary. Public routes
// must use publicAnalyticsEventSchema so server-only events cannot cross the
// browser boundary.
export const serverAnalyticsEventSchema = publicAnalyticsEventSchema.extend({
  eventName: z.enum(analyticsEventNames),
});
export const analyticsEventSchema = serverAnalyticsEventSchema;

export const leadSchema = z.object({
  conversionGoalId: conversionContext.conversionGoalId,
  entryPointId: conversionContext.entryPointId,
  destinationId: conversionContext.destinationId,
  presencePageId: conversionContext.presencePageId,
  presenceSectionId: conversionContext.presenceSectionId,
  attribution: conversionContext.attribution,
  projectId: shortId, sessionId: shortId, name: safeText.optional(),
  email: z.string().email().max(250).optional().or(z.literal("")), phone: z.string().max(40).regex(/^[\d+()\s-]*$/).optional().or(z.literal("")), company: safeText.optional(),
  source: safeText.optional(), campaign: safeText.optional(), recommendation: safeText.optional(),
  answers: z.record(z.string().max(80), z.string().max(1000)),
  capability: z.enum(["qualification", "quote", "scheduling", "catalog_order", "reservation", "routing", "payment"]).optional(),
  locationName: safeText.optional(),
  honeypot: z.string().max(0).optional(),
}).strict();

export const quoteRequestSchema = z.object({
  ...conversionContext,
  projectId: shortId,
  sessionId: shortId,
  idempotencyKey,
  answers,
  estimatedMin: z.number().nonnegative().max(100_000_000).optional(),
  estimatedMax: z.number().nonnegative().max(100_000_000).optional(),
  currency: z.string().length(3).default("BRL"),
  visitorData,
  attachments: z.array(z.object({ id: shortId, name: safeText, mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]), size: z.number().int().nonnegative().max(5_242_880), storagePath: z.string().max(500).optional(), url: z.string().url().optional() })).max(4).default([]),
  honeypot: z.string().max(0).optional(),
});

export const availabilitySearchSchema = z.object({
  projectId: shortId,
  serviceId: shortId,
  resourceId: shortId.optional(),
  date: z.string().date(),
  timezone: z.string().max(80).default("America/Sao_Paulo"),
});

export const bookingRequestSchema = z.object({
  ...conversionContext,
  projectId: shortId,
  sessionId: shortId,
  idempotencyKey,
  serviceId: shortId,
  resourceId: shortId.optional(),
  startsAt: z.string().datetime({ local: true }),
  endsAt: z.string().datetime({ local: true }),
  confirmationMode: z.enum(["instant", "manual_approval", "external_system"]),
  visitorData,
  honeypot: z.string().max(0).optional(),
}).refine((data) => new Date(data.endsAt) > new Date(data.startsAt), { message: "O horário final deve ser posterior ao inicial." });

export const bookingChangeSchema = z.object({
  sessionId: shortId,
  idempotencyKey,
  requestedStartsAt: z.string().datetime({ local: true }).optional(),
  reason: safeText.optional(),
});

export const orderRequestSchema = z.object({
  conversionGoalId: shortId.optional(), entryPointId: shortId.optional(), destinationId: shortId.optional(), presencePageId: shortId.optional(), presenceSectionId: shortId.optional(), activationId: z.string().uuid().optional(), attribution: conversionContext.attribution,
  projectId: shortId,
  sessionId: shortId,
  idempotencyKey,
  fulfillment: z.enum(["delivery", "pickup", "digital", "external"]),
  locationId: shortId.optional(),
  benefitClaimCode: z.string().trim().regex(/^[A-HJ-NP-Z2-9]{7}$/).optional(),
  items: z.array(z.object({ itemId: shortId, name: safeText, quantity: z.number().int().min(1).max(100), unitPrice: z.number().nonnegative().max(10_000_000), variantId: shortId.optional(), notes: safeText.optional() })).min(1).max(50),
  totals: z.object({ subtotal: z.number().nonnegative(), deliveryFee: z.number().nonnegative().optional(), discount: z.number().nonnegative().optional(), total: z.number().nonnegative(), currency: z.string().length(3) }).optional(),
  visitorData,
  honeypot: z.string().max(0).optional(),
});

export const reservationAvailabilitySchema = z.object({
  projectId: shortId,
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(30),
  children: z.number().int().min(0).max(30),
}).refine((data) => new Date(data.checkOut) > new Date(data.checkIn), { message: "A saída deve ser posterior à entrada." });

export const reservationRequestSchema = reservationAvailabilitySchema.extend({
  ...conversionContext,
  sessionId: shortId,
  idempotencyKey,
  unitId: shortId,
  total: z.number().nonnegative().max(100_000_000).optional(),
  depositAmount: z.number().nonnegative().max(100_000_000).optional(),
  visitorData,
  honeypot: z.string().max(0).optional(),
});

export const reservationChangeSchema = z.object({ sessionId: shortId, idempotencyKey, reason: safeText.optional() });

export const routingResolveSchema = z.object({
  projectId: shortId,
  sessionId: shortId,
  context: z.record(z.string().max(80), z.union([z.string().max(500), z.number().finite(), z.boolean()])),
});
