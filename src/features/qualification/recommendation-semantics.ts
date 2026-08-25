import type { FormField, JourneyMode, Project, ServiceOffering, StructuredJourneyQuestion } from "@/types";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const internalInstructionPatterns = [
  /\b(?:o sistema|a ia|a sobe)\s+(?:deve|devera|precisa|vai)\b/i,
  /\b(?:recomendar|retornar|selecionar|usar)\s+(?:um|uma|as|os)\s+(?:dos|das)?\s*(?:servicos|ofertas|opcoes)\b/i,
  /\b(?:encaminhar|qualificar|capturar)\s+(?:o|a|um|uma)?\s*(?:lead|visitante|cliente)\b/i,
  /\bcom base nas respostas,?\s+(?:recomendar|retornar|indicar)\b/i,
  /\b(?:instrucao|regra interna|prompt|schema|output|retorne apenas)\b/i,
];

export function containsInternalInstruction(value: string | undefined) {
  if (!value?.trim()) return false;
  return internalInstructionPatterns.some((pattern) => pattern.test(normalize(value)));
}

export function classifyJourneyMode(value: string): JourneyMode {
  const text = normalize(value);
  const discovery = /recomend|orient|descobr|encontr.*(?:opcao|servico|caminho)|melhor.*(?:opcao|servico|caminho)|qual.*(?:opcao|servico).*(?:adequad|ideal)/.test(text);
  return discovery ? "assisted_discovery" : "explicit_choice";
}

export function journeyModeForProject(project: Project): JourneyMode {
  const configured = project.steps
    .map((step) => step.settings?.journeyMode)
    .find((value): value is JourneyMode => value === "explicit_choice" || value === "assisted_discovery");
  return configured || classifyJourneyMode(project.primaryGoal);
}

export function questionQualityIssues(question: Pick<StructuredJourneyQuestion, "question" | "type" | "options" | "purpose">) {
  const value = question.question.trim();
  const normalized = normalize(value);
  const issues: string[] = [];
  if (value.length < 12 || value.split(/\s+/).length < 3) issues.push("fragment");
  if (!value.endsWith("?") && !/\b(?:qual|quais|como|quando|onde|quanto|conte|descreva|indique|selecione|escolha|voce)\b/.test(normalized)) issues.push("not-a-question");
  if ((value.match(/\?/g) || []).length > 1) issues.push("multiple-questions");
  if (/\b(?:qual|quais|como|quando|onde|quanto)\b.+\b(?:qual|quais|como|quando|onde|quanto)\b/.test(normalized)) issues.push("multiple-questions");
  if (containsInternalInstruction(value)) issues.push("internal-language");
  if ((question.type === "select" || question.type === "radio") && !(question.options || []).filter(Boolean).length) issues.push("missing-options");
  return [...new Set(issues)];
}

export function isCircularOfferSelector(field: FormField, offerings: ServiceOffering[]) {
  if (!field.required || !["select", "radio"].includes(field.type) || !field.options?.length || !offerings.length) return false;
  const offerNames = new Set(offerings.filter((offer) => offer.isActive).map((offer) => normalize(offer.name)));
  const options = field.options.map(normalize).filter(Boolean);
  return options.length > 0 && options.every((option) => offerNames.has(option));
}

export function publicJourneyCopy(project: Project) {
  return project.steps.flatMap((step) => [
    step.title,
    step.description,
    ...(step.options || []).flatMap((option) => [option.label, option.description]),
    ...(step.formFields || []).flatMap((field) => [field.label, field.placeholder]),
    step.recommendation?.title,
    step.recommendation?.description,
    step.recommendation?.label,
    ...(step.recommendation?.benefits || []),
    ...(step.recommendation?.deliverables || []),
  ]).filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
}

export function hasPublicCopyLeak(project: Project) {
  return publicJourneyCopy(project).some(containsInternalInstruction);
}
