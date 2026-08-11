import { z } from "zod";

export const conversionGoalKindSchema = z.enum(["buy", "request_quote", "schedule", "reserve", "contact", "visit", "learn", "custom"]);
export const conversionGoalSchema = z.object({
  id: z.string().min(1), projectId: z.string().min(1), name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(), kind: conversionGoalKindSchema,
  targetStepId: z.string().min(1), destinationLabel: z.string().trim().max(80).optional(),
  isPrimary: z.boolean().default(false), isActive: z.boolean().default(true), order: z.number().int().nonnegative(),
  createdAt: z.string().optional(), updatedAt: z.string().optional(),
});
export const conversionGoalsSchema = z.array(conversionGoalSchema).superRefine((goals, context) => {
  if (goals.filter((goal) => goal.isActive && goal.isPrimary).length > 1) context.addIssue({ code: "custom", message: "Apenas uma meta ativa pode ser principal." });
  const orders = goals.map((goal) => goal.order);
  if (new Set(orders).size !== orders.length) context.addIssue({ code: "custom", message: "A ordem das metas deve ser única." });
});

export type ConversionGoalInput = z.infer<typeof conversionGoalSchema>;
