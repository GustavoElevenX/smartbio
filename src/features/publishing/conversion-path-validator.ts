import { isRecommendationIntent } from "@/features/composition/public-copy";
import type { JourneyStep, Project, RoutingDestination, StepOption } from "@/types";

export type ConversionPathCheckKey = "entry" | "questions" | "result" | "destination";

export interface ConversionPathCheck {
  key: ConversionPathCheckKey;
  valid: boolean;
  label: string;
  reason: string;
}
export interface ConversionPathValidation {
  kind: "recommendation" | "direct";
  complete: boolean;
  checks: ConversionPathCheck[];
}

function isHttpUrl(value: unknown) {
  try { return ["http:", "https:"].includes(new URL(String(value)).protocol); } catch { return false; }
}

function isPhone(value: unknown) {
  return /^[1-9]\d{7,14}$/.test(String(value || "").replace(/\D/g, ""));
}

function destination(project: Project, option: StepOption): RoutingDestination | undefined {
  return project.commercialConfig?.routingDestinations?.find((item) => item.id === option.actionPayload?.destinationId);
}

function isTerminal(project: Project, option: StepOption) {
  const configured = destination(project, option);
  if (option.actionType === "submit_form" || option.actionType === "finish") return true;
  if (option.actionType === "open_whatsapp") return isPhone(configured?.value || option.actionPayload?.phone || project.phone);
  if (option.actionType === "open_url") return isHttpUrl(configured?.value || option.actionPayload?.url);
  return false;
}

function reachesTerminal(project: Project, start: JourneyStep, visited = new Set<string>()): boolean {
  if (visited.has(start.id)) return false;
  visited.add(start.id);
  return Boolean(start.options?.some((option) => {
    if (isTerminal(project, option)) return true;
    if (!option.targetStepId) return false;
    const target = project.steps.find((step) => step.id === option.targetStepId && step.isActive);
    return target ? reachesTerminal(project, target, new Set(visited)) : false;
  }));
}

export function validateConversionPath(project: Project): ConversionPathValidation {
  const active = project.steps.filter((step) => step.isActive);
  const primaryGoal = project.conversionGoals?.find((goal) => goal.isPrimary && goal.isActive)
    || project.conversionGoals?.find((goal) => goal.isActive);
  const recommendation = isRecommendationIntent(`${project.primaryGoal} ${primaryGoal?.name || ""} ${primaryGoal?.description || ""}`);
  if (!recommendation) {
    const complete = active.some((step) => reachesTerminal(project, step));
    return {
      kind: "direct",
      complete,
      checks: [{ key: "destination", valid: complete, label: "Próxima ação", reason: complete ? "Existe uma ação final funcional." : "A jornada não chega a um destino funcional." }],
    };
  }

  const form = active.find((step) => step.type === "form" && Boolean(step.formFields?.length));
  const result = active.find((step) => step.type === "recommendation" && Boolean(step.recommendation));
  const goalTarget = primaryGoal ? active.find((step) => step.id === primaryGoal.targetStepId) : undefined;
  const entryValid = Boolean(form && (!goalTarget || goalTarget.id === form.id || goalTarget.type === "choice" || goalTarget.type === "welcome"));
  const destinationValid = Boolean(result && reachesTerminal(project, result));
  const checks: ConversionPathCheck[] = [
    { key: "entry", valid: entryValid, label: "Entrada da orientação", reason: entryValid ? "A ação principal inicia a orientação." : "A ação principal não inicia uma etapa de orientação válida." },
    { key: "questions", valid: Boolean(form?.formFields?.length), label: "Perguntas da orientação", reason: form?.formFields?.length ? "Existem perguntas para entender a necessidade." : "Adicione as perguntas necessárias para produzir o resultado." },
    { key: "result", valid: Boolean(result), label: "Resultado da orientação", reason: result ? "A jornada apresenta um resultado compreensível." : "A jornada promete orientar, mas não apresenta um resultado." },
    { key: "destination", valid: destinationValid, label: "Próxima ação da orientação", reason: destinationValid ? "O resultado conduz a uma próxima ação funcional." : "O resultado ainda não possui uma próxima ação funcional." },
  ];
  return { kind: "recommendation", complete: checks.every((check) => check.valid), checks };
}
