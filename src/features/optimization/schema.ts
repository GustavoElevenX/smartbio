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

export const optimizationAIExplanationSchema = z.object({
  explanation: z.string().trim().min(1).max(1000),
  recommendedAction: z.string().trim().min(1).max(500),
});

export type OptimizationAIExplanation = z.infer<typeof optimizationAIExplanationSchema>;
