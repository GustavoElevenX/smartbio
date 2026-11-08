import { buildJourneyHandoff } from "@/features/handoff/journey-handoff";
import { formatCommercialHandoff } from "@/features/handoff/handoff-formatter";
import type { ConversionGoal, FormField, Project } from "@/types";

export function previewFieldsForGoal(project: Project, goal: ConversionGoal): FormField[] {
  const steps = new Map(project.steps.filter((step) => step.isActive).map((step) => [step.id, step]));
  const queue = [goal.targetStepId];
  const visited = new Set<string>();
  const fields = new Map<string, FormField>();
  while (queue.length && visited.size < 20) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const step = steps.get(id);
    if (!step) continue;
    for (const field of step.formFields || []) if (field.includeInHandoff !== false && !fields.has(field.key)) fields.set(field.key, field);
    for (const option of step.options || []) if (option.targetStepId && !visited.has(option.targetStepId)) queue.push(option.targetStepId);
  }
  return [...fields.values()].slice(0, 4);
}

export function simulatedBriefing(project: Project, goal: ConversionGoal, answers: Record<string, string>) {
  const fields = previewFieldsForGoal(project, goal);
  const handoff = buildJourneyHandoff({ intent: { label: goal.name }, answers, fields, includeAll: true });
  const message = formatCommercialHandoff({
    projectId: project.id,
    conversionGoalId: goal.id,
    origin: { source: "simulação" },
    identity: {},
    intent: { label: handoff.interest },
    qualification: handoff.entries.map((entry) => ({ label: entry.label, value: entry.value, include: true })),
  }, project);
  const pending = fields.filter((field) => !String(answers[field.key] || "").trim()).map((field) => field.label);
  return { message, pending, fields };
}
