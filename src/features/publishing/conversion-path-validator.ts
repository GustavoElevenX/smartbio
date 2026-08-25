import { isRecommendationIntent } from "@/features/composition/public-copy";
import {
  hasPublicCopyLeak,
  isCircularOfferSelector,
  journeyModeForProject,
  questionQualityIssues,
} from "@/features/qualification/recommendation-semantics";
import {
  offerIntelligenceFor,
  offerIntelligenceIsSufficient,
} from "@/features/qualification/offer-intelligence";
import type { JourneyStep, Project, RoutingDestination, StepOption } from "@/types";

export type ConversionPathCheckKey = "entry" | "primary_action" | "questions" | "progressive_questioning" | "circularity" | "offer_integrity" | "result" | "result_quality" | "context" | "public_copy" | "destination";

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
  const journeyMode = journeyModeForProject(project);
  const recommendation = journeyMode === "assisted_discovery" || isRecommendationIntent(`${project.primaryGoal} ${primaryGoal?.name || ""} ${primaryGoal?.description || ""}`);
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
  const offerings = project.commercialConfig?.serviceOfferings?.filter((offering) => offering.isActive) || [];
  const goalTarget = primaryGoal ? active.find((step) => step.id === primaryGoal.targetStepId) : undefined;
  const entryValid = Boolean(form && (!goalTarget || goalTarget.id === form.id || goalTarget.type === "choice" || goalTarget.type === "welcome"));
  const destinationValid = Boolean(result && reachesTerminal(project, result));
  const fields = form?.formFields || [];
  const invalidQuestions = fields.filter((field) => questionQualityIssues({
    question: field.label,
    type: ["select", "radio", "checkbox"].includes(field.type) ? field.type as "select" | "radio" | "checkbox" : "textarea",
    options: field.options,
    purpose: field.purpose || "signal",
  }).length);
  const circular = fields.some((field) => isCircularOfferSelector(field, offerings));
  const usefulQuestions = fields.some((field) => ["need", "signal", "context", "constraint"].includes(field.purpose || "signal"));
  const intelligenceQuestions = offerings.flatMap((offering) => offerIntelligenceFor(offering)?.discriminatingQuestions.map((item) => item.question) || []);
  const normalizedIntelligenceQuestions = new Set(intelligenceQuestions.map((question) => question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\?$/, "")));
  const questionsDerived = fields.some((field) => normalizedIntelligenceQuestions.has(field.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\?$/, "")));
  const configuredOfferIds = Array.isArray(result?.settings?.recommendationOfferIds)
    ? result.settings.recommendationOfferIds.filter((id): id is string => typeof id === "string")
    : [];
  const realResult = Boolean(result && configuredOfferIds.length && configuredOfferIds.some((id) => offerings.some((offering) => offering.id === id)));
  const expectedOfferNames = Array.isArray(result?.settings?.explicitOfferNames)
    ? result.settings.explicitOfferNames.filter((name): name is string => typeof name === "string" && Boolean(name.trim()))
    : [];
  const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const actualNames = new Set(offerings.map((offering) => normalizeName(offering.name)));
  const profilesDiscriminate = offerings.length < 2 || offerings.every((offering) => {
    const profile = offerIntelligenceFor(offering);
    return profile?.discriminatingQuestions.some((question) => question.separatesFromOfferNames.some((name) => (
      normalizeName(name) !== normalizeName(offering.name) && actualNames.has(normalizeName(name))
    ))) === true;
  });
  const offerIntegrity = expectedOfferNames.length > 0
    && expectedOfferNames.every((name) => actualNames.has(normalizeName(name)))
    && offerings.every((offering) => configuredOfferIds.includes(offering.id));
  const resultQuality = realResult && profilesDiscriminate && offerings.length > 0
    && offerings.every((offering) => offerIntelligenceIsSufficient(offering, project.id));
  const progressiveQuestioning = form?.settings?.progressiveQuestioning === true
    && result?.settings?.progressiveQuestioning === true;
  const primaryActionValid = Boolean(primaryGoal && isRecommendationIntent(primaryGoal.name));
  const contextSafe = offerings.every((offering) => {
    if (offering.settings?.descriptionSource !== "generated_conservative") return true;
    const provenance = offering.settings?.copyProvenance;
    return Boolean(provenance && typeof provenance === "object" && (provenance as { projectId?: unknown }).projectId === project.id);
  });
  const publicCopySafe = !hasPublicCopyLeak(project);
  const checks: ConversionPathCheck[] = [
    { key: "entry", valid: entryValid, label: "Entrada da orientação", reason: entryValid ? "A ação principal inicia a orientação." : "A ação principal não inicia uma etapa de orientação válida." },
    { key: "primary_action", valid: primaryActionValid, label: "Ação principal coerente", reason: primaryActionValid ? "A ação principal materializa a descoberta antes do contato final." : "O objetivo pede orientação, mas a ação principal não inicia a descoberta assistida." },
    { key: "questions", valid: fields.length > 0 && !invalidQuestions.length && usefulQuestions && questionsDerived, label: "Perguntas da orientação", reason: fields.length > 0 && !invalidQuestions.length && usefulQuestions && questionsDerived ? "As perguntas derivam das diferenças registradas entre as ofertas." : "Revise perguntas fragmentadas, genéricas ou desconectadas do Offer Intelligence." },
    { key: "progressive_questioning", valid: progressiveQuestioning, label: "Perguntas progressivas", reason: progressiveQuestioning ? "A jornada pode encerrar perguntas quando já existe evidência forte e pedir mais contexto quando necessário." : "A descoberta assistida ainda obriga uma sequência fixa de perguntas." },
    { key: "circularity", valid: !circular, label: "Descoberta sem escolha circular", reason: circular ? "A orientação pede que o visitante escolha diretamente a mesma oferta que deveria ser inferida." : "A orientação parte da necessidade antes de apresentar uma opção." },
    { key: "offer_integrity", valid: offerIntegrity, label: "Integridade das ofertas", reason: offerIntegrity ? "Todas as ofertas confirmadas participam da orientação." : "Uma oferta explicitamente fornecida foi perdida ou ficou fora do resultado materializado." },
    { key: "result", valid: realResult, label: "Resultado da orientação", reason: realResult ? "A jornada apresenta uma oferta real como resultado." : "A jornada promete orientar, mas não possui uma oferta real configurada como resultado." },
    { key: "result_quality", valid: resultQuality, label: "Explicação da orientação", reason: resultQuality ? "As ofertas possuem sinais ou descrições suficientes para explicar o resultado." : "Adicione sinais ou descrições sustentadas pelos dados do negócio para diferenciar o resultado." },
    { key: "context", valid: contextSafe, label: "Contexto das ofertas", reason: contextSafe ? "A copy gerada está vinculada ao projeto atual." : "Uma descrição gerada não possui proveniência do projeto atual e precisa ser regenerada." },
    { key: "public_copy", valid: publicCopySafe, label: "Texto público da orientação", reason: publicCopySafe ? "O texto público está separado das instruções internas." : "Uma instrução interna apareceu em título, pergunta, explicação ou botão visível ao visitante." },
    { key: "destination", valid: destinationValid, label: "Próxima ação da orientação", reason: destinationValid ? "O resultado conduz a uma próxima ação funcional." : "O resultado ainda não possui uma próxima ação funcional." },
  ];
  return { kind: "recommendation", complete: checks.every((check) => check.valid), checks };
}
