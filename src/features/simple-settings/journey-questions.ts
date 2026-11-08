import type { ConversionGoal, FormField, Project } from "@/types";

export function editableQuestionsForGoal(project: Project, goal: ConversionGoal): Array<{ stepId: string; field: FormField }> {
  const steps = new Map(project.steps.filter((step) => step.isActive).map((step) => [step.id, step]));
  const queue = [goal.targetStepId];
  const visited = new Set<string>();
  const otherGoalTargets = new Set((project.conversionGoals || []).filter((item) => item.id !== goal.id && item.isActive).map((item) => item.targetStepId));
  const questions: Array<{ stepId: string; field: FormField }> = [];
  while (queue.length && visited.size < 20) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (otherGoalTargets.has(id)) continue;
    const step = steps.get(id);
    if (!step) continue;
    if (step.type === "form") {
      for (const field of step.formFields || []) {
        if (["email", "phone", "file"].includes(field.type) || /^(?:name|nome|email|phone|telefone)$/i.test(field.key)) continue;
        questions.push({ stepId: step.id, field });
      }
    }
    for (const option of step.options || []) if (option.targetStepId && !visited.has(option.targetStepId)) queue.push(option.targetStepId);
  }
  return questions;
}

export function editableQuestionStepForGoal(project: Project, goal: ConversionGoal): string | undefined {
  const steps = new Map(project.steps.filter((step) => step.isActive).map((step) => [step.id, step]));
  const queue = [goal.targetStepId];
  const visited = new Set<string>();
  const otherGoalTargets = new Set((project.conversionGoals || []).filter((item) => item.id !== goal.id && item.isActive).map((item) => item.targetStepId));
  while (queue.length && visited.size < 20) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (otherGoalTargets.has(id)) continue;
    const step = steps.get(id);
    if (!step) continue;
    if (step.type === "form") return step.id;
    for (const option of step.options || []) if (option.targetStepId && !visited.has(option.targetStepId)) queue.push(option.targetStepId);
  }
  return undefined;
}

export function editJourneyQuestion(project: Project, stepId: string, fieldId: string, change: Partial<FormField>): Project {
  return { ...project, steps: project.steps.map((step) => step.id === stepId ? {
    ...step,
    formFields: step.formFields?.map((field) => field.id === fieldId ? { ...field, ...change } : field),
  } : step) };
}

export function removeJourneyQuestion(project: Project, stepId: string, fieldId: string): Project {
  return { ...project, steps: project.steps.map((step) => step.id === stepId ? {
    ...step,
    formFields: step.formFields?.filter((field) => field.id !== fieldId),
  } : step) };
}

export function addJourneyQuestion(project: Project, stepId: string, label = "Nova pergunta"): Project {
  const used = new Set(project.steps.flatMap((step) => (step.formFields || []).map((field) => field.key)));
  let suffix = 1;
  while (used.has(`question_simple_${suffix}`)) suffix += 1;
  const field: FormField = { id: crypto.randomUUID(), key: `question_simple_${suffix}`, label, type: "text", required: false, includeInHandoff: true, purpose: "context" };
  return { ...project, steps: project.steps.map((step) => step.id === stepId ? {
    ...step,
    formFields: [...(step.formFields || []), field],
  } : step) };
}
