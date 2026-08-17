import { z } from "zod";

export const optimizationEvidenceSchema = z.object({
  publishedAt: z.iso.datetime(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  totalSessions: z.number().int().nonnegative(),
  goalSessions: z.number().int().nonnegative().optional(),
  currentRate: z.number().nonnegative(),
  comparisonRate: z.number().nonnegative().optional(),
});
