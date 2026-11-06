import { conversionGoalsSchema } from "@/features/conversion-goals/schema";
import { discoveryPlanSchema } from "@/features/qualification/discovery-plan";
import type { Project } from "@/types";

type Question = NonNullable<Project["discoveryPlan"]>["questions"][number];

export function withDiscoveryQuestions(project: Project, questions: Question[]): Project {
  const plan = project.discoveryPlan;
  if (!plan) return project;
  const oldIds = new Set(plan.questions.map((question) => question.id));
  return {
    ...project,
    discoveryPlan: { ...plan, questions, provenance: { ...plan.provenance, source: "business_confirmed" } },
    steps: project.steps.map((step) => {
      if (step.settings?.discoveryPlanId !== plan.id || !step.formFields?.some((field) => oldIds.has(field.id))) return step;
      const related = step.formFields.filter((field) => oldIds.has(field.id));
      const other = step.formFields.filter((field) => !oldIds.has(field.id));
      return { ...step, formFields: [
        ...questions.map((question) => {
          const previous = related.find((field) => field.id === question.id);
          return { ...previous, id: question.id, key: previous?.key || `qualification_simple_${question.id.replace(/[^a-zA-Z0-9]/g, "_")}`, label: question.question, type: question.type, options: question.options, required: question.required, purpose: question.purpose, includeInHandoff: true };
        }),
        ...other,
      ] };
    }),
  };
}

export function validateSimpleProject(project: Project): string | null {
  const goals = project.conversionGoals || [];
  const parsedGoals = conversionGoalsSchema.safeParse(goals);
  if (!parsedGoals.success) return "Revise o nome e a ordem das intenções antes de salvar.";
  const stepIds = new Set(project.steps.filter((step) => step.isActive).map((step) => step.id));
  if (goals.some((goal) => goal.isActive && !stepIds.has(goal.targetStepId))) return "Uma intenção ativa precisa de uma etapa de atendimento válida.";
  if (goals.length && !goals.some((goal) => goal.isActive)) return "Mantenha pelo menos uma intenção ativa.";
  if (project.publication?.conversionGoalId && !goals.some((goal) => goal.id === project.publication?.conversionGoalId && goal.isActive)) return "A intenção usada pela página inicial precisa continuar ativa.";
  if (project.entryPoints?.some((entry) => entry.conversionGoalId && !goals.some((goal) => goal.id === entry.conversionGoalId && goal.isActive))) return "Uma entrada usa esta intenção. Ajuste a entrada antes de desativá-la.";
  if (project.discoveryPlan && !discoveryPlanSchema.safeParse(project.discoveryPlan).success) return "Mantenha de 2 a 4 perguntas válidas, com texto preenchido.";
  return null;
}
