import { z } from "zod";

export const publicHandoffContextSchema = z.object({
  projectId: z.string().min(1), projectName: z.string().max(160).optional(), conversionGoalId: z.string().optional(),
  origin: z.object({ entryPointId: z.string().optional(), source: z.string().optional(), campaign: z.string().optional(), pageId: z.string().optional(), activationId: z.string().optional() }),
  identity: z.object({ name: z.string().optional(), phone: z.string().optional(), email: z.string().optional() }),
  intent: z.object({ label: z.string().optional(), visitorRequest: z.string().max(2000).optional(), productIds: z.array(z.string()).max(50).optional(), serviceIds: z.array(z.string()).max(50).optional(), locationId: z.string().optional() }),
  qualification: z.array(z.object({ label: z.string().max(120), value: z.string().max(1000), include: z.boolean(), source: z.enum(["visitor", "business_confirmed"]).optional() })).max(100),
  pending: z.array(z.string().max(240)).max(20).optional(),
  consent: z.object({ contact: z.boolean(), recordedAt: z.string().optional() }).optional(),
  benefit: z.object({ label: z.string().optional(), code: z.string().optional() }).optional(),
});
