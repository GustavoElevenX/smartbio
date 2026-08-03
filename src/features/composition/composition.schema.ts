import { z } from "zod";

const optionSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(160),
  description: z.string().max(300).optional(),
  value: z.string().min(1).max(120),
  actionType: z.enum(["go_to_step", "open_url", "open_whatsapp", "submit_form", "show_recommendation", "start_capability", "finish"]),
  targetStepId: z.string().optional(),
  actionPayload: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const journeyCompositionSchema = z.object({
  steps: z.array(z.object({
    id: z.string(),
    type: z.enum(["welcome", "choice", "form", "content", "recommendation", "action", "thank_you", "quote", "catalog", "cart", "availability", "schedule", "reservation", "routing", "confirmation"]),
    title: z.string().min(1).max(180),
    description: z.string().max(500).optional(),
    order: z.number().int().min(0).max(30),
    isActive: z.boolean(),
    visualVariant: z.string().max(100).optional(),
    options: z.array(optionSchema).optional(),
    blocks: z.array(z.object({ id: z.string(), type: z.string(), variant: z.string().optional(), content: z.record(z.string(), z.unknown()).optional() })).optional(),
    formFields: z.array(z.object({
      id: z.string(), label: z.string(), key: z.string(), type: z.string(), placeholder: z.string().optional(), required: z.boolean(), options: z.array(z.string()).optional(),
    })).optional(),
    recommendation: z.object({ title: z.string(), description: z.string(), label: z.string().optional(), benefits: z.array(z.string()), deliverables: z.array(z.string()).optional() }).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(30),
});
