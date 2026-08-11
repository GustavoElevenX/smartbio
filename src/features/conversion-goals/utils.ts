import type { ConversionGoal, JourneyStep, Project } from "@/types";

const goalKindByStep: Record<string, ConversionGoal["kind"]> = {
  quote: "request_quote", schedule: "schedule", availability: "schedule", reservation: "reserve",
  catalog: "buy", cart: "buy", routing: "visit", form: "contact", recommendation: "learn",
};

export function inferGoalKind(step: JourneyStep): ConversionGoal["kind"] {
  return goalKindByStep[step.type] || "custom";
}

export function backfillConversionGoals(project: Project): ConversionGoal[] {
  if (project.conversionGoals?.length) return project.conversionGoals;
  const active = [...project.steps].filter((step) => step.isActive).sort((a, b) => a.order - b.order);
  const candidates = active.filter((step) => ["choice", "quote", "schedule", "reservation", "catalog", "routing", "form"].includes(step.type));
  const selected = candidates.length ? candidates.slice(0, 4) : active.slice(0, 1);
  return selected.map((step, order) => ({
    id: `${project.id}-goal-${order + 1}`, projectId: project.id, name: step.title,
    description: step.description, kind: inferGoalKind(step), targetStepId: step.id,
    destinationLabel: project.primaryDestination, isPrimary: order === 0, isActive: true, order,
  }));
}

export function primaryConversionGoal(project: Project) {
  const goals = backfillConversionGoals(project).filter((goal) => goal.isActive);
  return goals.find((goal) => goal.isPrimary) || goals[0];
}
