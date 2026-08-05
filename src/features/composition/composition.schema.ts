import { z } from "zod";

export const capabilityKeySchema = z.enum(["qualification", "quote", "scheduling", "catalog_order", "reservation", "routing", "payment"]);

const optionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(160),
  description: z.string().max(300).optional(),
  value: z.string().min(1).max(120),
  actionType: z.enum(["go_to_step", "open_url", "open_whatsapp", "submit_form", "show_recommendation", "start_capability", "finish"]),
  targetStepId: z.string().optional(),
  actionPayload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const journeyStepSchema = z.object({
    id: z.string(),
    type: z.enum(["welcome", "choice", "form", "content", "recommendation", "action", "thank_you", "quote", "catalog", "cart", "availability", "schedule", "reservation", "routing", "confirmation"]),
    title: z.string().min(1).max(180),
    description: z.string().max(500).optional(),
    order: z.number().int().min(0).max(30),
    isActive: z.boolean(),
    visualVariant: z.string().max(100).optional(),
    options: z.array(optionSchema).optional(),
    blocks: z.array(z.object({ id: z.string(), type: z.string(), variant: z.string().optional(), content: z.record(z.string(), z.unknown()).optional(), style: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional() })).optional(),
    formFields: z.array(z.object({
      id: z.string(), label: z.string(), key: z.string(), type: z.string(), placeholder: z.string().optional(), required: z.boolean(), options: z.array(z.string()).optional(),
    })).optional(),
    recommendation: z.object({ title: z.string(), description: z.string(), label: z.string().optional(), benefits: z.array(z.string()), deliverables: z.array(z.string()).optional() }).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  });

export const journeyCompositionSchema = z.object({
  steps: z.array(journeyStepSchema).min(1).max(30),
});

export const aiJourneyDraftSchema = z.object({
  summary: z.string().min(1).max(500),
  rationale: z.array(z.string().min(1).max(300)).max(12),
  steps: z.array(journeyStepSchema).min(1).max(30),
  suggestedCapabilities: z.array(z.object({
    key: capabilityKeySchema,
    enabled: z.boolean(),
    source: z.literal("ai"),
    version: z.number().int().min(1),
    configuration: z.record(z.string(), z.unknown()),
  })).max(7),
  commercialConfigPatch: z.record(z.string(), z.unknown()),
  requirements: z.array(z.object({
    id: z.string(),
    key: z.string().min(1).max(120),
    label: z.string().min(1).max(180),
    capability: z.union([capabilityKeySchema, z.enum(["brand", "project"])]),
    status: z.enum(["verified", "needs_confirmation", "missing", "invalid"]),
    severity: z.enum(["blocking", "warning", "optional"]),
    value: z.unknown().optional(),
    origin: z.enum(["user", "website", "document", "logo_analysis", "ai_inference", "generated_copy", "system_default"]).optional(),
    sourceId: z.string().optional(),
    reason: z.string().min(1).max(400),
    actionLabel: z.string().max(100).optional(),
    actionPath: z.string().max(300).optional(),
  })).max(80),
  generatedCopyFields: z.array(z.string().min(1).max(160)).max(80),
});

export type AIJourneyDraftPayload = z.infer<typeof aiJourneyDraftSchema>;
