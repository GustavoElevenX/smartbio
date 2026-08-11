import { z } from "zod";
export const optimizationEvidenceSchema = z.object({ totalSessions: z.number().int().nonnegative(), goalSessions: z.number().int().nonnegative().optional(), currentRate: z.number().nonnegative(), comparisonRate: z.number().nonnegative().optional() });
