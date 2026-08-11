import type { ConversionGoal, Project } from "@/types";
import { conversionGoalsSchema } from "./schema";

export function setProjectConversionGoals(project: Project, goals: ConversionGoal[]): Project {
  const parsed = conversionGoalsSchema.parse(goals).sort((a, b) => a.order - b.order);
  const stepIds = new Set(project.steps.map((step) => step.id));
  if (parsed.some((goal) => !stepIds.has(goal.targetStepId))) throw new Error("Toda meta precisa apontar para uma etapa da jornada.");
  return { ...project, conversionGoals: parsed, updatedAt: new Date().toISOString(), version: project.version + 1 };
}
