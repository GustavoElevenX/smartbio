import { z } from "zod";

export const entryPointSchema = z.object({
  id: z.string().min(1), projectId: z.string().min(1), key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  name: z.string().trim().min(2).max(80), conversionGoalId: z.string().min(1).optional(), targetStepId: z.string().min(1).optional(),
  channel: z.enum(["bio", "story", "ad", "qr", "linkedin", "other"]),
  utmSource: z.string().trim().max(100).optional(), utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(100).optional(), utmContent: z.string().trim().max(100).optional(),
  utmTerm: z.string().trim().max(100).optional(), isActive: z.boolean().default(true),
  createdAt: z.string().optional(), updatedAt: z.string().optional(),
}).refine((entry) => entry.conversionGoalId || entry.targetStepId, "Defina uma meta ou etapa de destino.");
