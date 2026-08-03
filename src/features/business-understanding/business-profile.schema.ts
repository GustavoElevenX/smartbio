import { z } from "zod";

export const offerKindSchema = z.enum([
  "physical_product", "digital_product", "service", "professional_service", "hospitality", "rental", "event", "content", "membership", "mixed",
]);

export const commercialIntentSchema = z.enum([
  "buy", "order", "request_quote", "schedule", "reserve", "check_availability", "request_proposal", "contact", "visit", "register", "pay_deposit", "continue_external",
]);

export const confirmationModeSchema = z.enum(["instant", "manual_approval", "external_system"]);
export const capacityKindSchema = z.enum(["none", "time_slot", "professional", "location", "room", "table", "asset", "inventory", "daily_capacity"]);
export const completionChannelSchema = z.enum(["native", "whatsapp", "external_url", "email", "phone"]);

export const businessCapabilityProfileSchema = z.object({
  offerKinds: z.array(offerKindSchema).min(1).max(10),
  primaryIntents: z.array(commercialIntentSchema).min(1).max(5),
  secondaryIntents: z.array(commercialIntentSchema).max(8),
  confirmationMode: confirmationModeSchema,
  capacityKinds: z.array(capacityKindSchema).min(1).max(9),
  hasMultipleLocations: z.boolean(),
  requiresQualification: z.boolean(),
  requiresMediaUpload: z.boolean(),
  requiresPayment: z.boolean(),
  allowsCancellationRequest: z.boolean(),
  allowsRescheduleRequest: z.boolean(),
  completionChannel: completionChannelSchema,
  requiredVisitorData: z.array(z.string().trim().min(1).max(80)).max(20),
  businessRules: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(300),
    value: z.union([z.string().max(500), z.number().finite(), z.boolean()]).optional(),
  })).max(30),
  analysisMetadata: z.object({
    source: z.enum(["rules", "ai", "user"]),
    confidence: z.number().min(0).max(1),
    reasons: z.array(z.string().max(300)).max(20),
    analyzedAt: z.string(),
  }).optional(),
});

export type BusinessCapabilityProfilePayload = z.infer<typeof businessCapabilityProfileSchema>;
