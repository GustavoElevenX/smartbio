import type { CommercialHandoffContext } from "./commercial-handoff-context";

function line(label: string, value?: string) {
  return value ? `${label}: ${value}` : undefined;
}

export function formatCommercialHandoff(context: CommercialHandoffContext) {
  const products = context.intent.productIds?.length ? context.intent.productIds.join(", ") : undefined;
  const services = context.intent.serviceIds?.length ? context.intent.serviceIds.join(", ") : undefined;
  const qualification = context.qualification.filter((item) => item.include).map((item) => `${item.label}: ${item.value}`);
  return [
    "Contexto recebido pela Sobe",
    line("Interesse", context.intent.label),
    line("Produtos", products),
    line("Serviços", services),
    line("Unidade", context.intent.locationId),
    ...qualification,
    line("Benefício", context.benefit?.label),
    line("Código", context.benefit?.code),
    line("Nome", context.identity.name),
    line("Telefone", context.identity.phone),
    line("E-mail", context.identity.email),
    line("Origem", context.origin.source),
    line("Campanha", context.origin.campaign),
  ].filter(Boolean).join("\n");
}

export function formatHandoffUrl(baseUrl: string, context: CommercialHandoffContext) {
  const url = new URL(baseUrl);
  url.searchParams.set("text", formatCommercialHandoff(context));
  return url.toString();
}

export function toPerformanceEvidence(context: CommercialHandoffContext) {
  return {
    projectId: context.projectId,
    conversionGoalId: context.conversionGoalId,
    origin: context.origin.source,
    hasProducts: Boolean(context.intent.productIds?.length),
    hasServices: Boolean(context.intent.serviceIds?.length),
    qualificationAnswerCount: context.qualification.filter((item) => item.include).length,
    benefitCodePresent: Boolean(context.benefit?.code),
  };
}
