import { z } from "zod";
export const attributionSchema = z.object({ entryPointId: z.string().optional(), conversionGoalId: z.string().optional(), source: z.string().min(1), medium: z.string().optional(), campaign: z.string().optional(), content: z.string().optional(), term: z.string().optional(), referrer: z.string().optional() });
