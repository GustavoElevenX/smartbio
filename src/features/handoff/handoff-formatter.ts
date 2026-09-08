import type { CommercialHandoffContext } from "./commercial-handoff-context";
import type { Project } from "@/types";

function line(label: string, value?: string) {
  return value ? `${label}: ${value}` : undefined;
}

export function formatCommercialHandoff(context: CommercialHandoffContext, project?: Project) {
  const products = project?.commercialConfig?.catalogItems?.filter((item) => context.intent.productIds?.includes(item.id)).map((item) => item.name).join(", ");
  const services = project?.commercialConfig?.serviceOfferings?.filter((item) => context.intent.serviceIds?.includes(item.id)).map((item) => item.name).join(", ");
  const location = project?.commercialConfig?.locations?.find((item) => item.id === context.intent.locationId)?.name;
  const entries = context.qualification.filter((item) => item.include && item.value.trim());
  const alreadyIncluded = (value?: string) => Boolean(value && entries.some((item) => item.value.trim() === value.trim()));
  const qualification = entries.map((item) => `${item.label}: ${item.value}`);
  return [
    "Contexto recebido pela Sobe",
    line("Interesse", context.intent.label),
    line("Produtos", alreadyIncluded(products) || entries.some((item) => item.label === "Pedido") ? undefined : products),
    line("Serviços", alreadyIncluded(services) ? undefined : services),
    line("Unidade", alreadyIncluded(location) ? undefined : location),
    ...qualification,
    line("Benefício", context.benefit?.label),
    line("Código", context.benefit?.code),
    line("Nome", alreadyIncluded(context.identity.name) ? undefined : context.identity.name),
    line("Telefone", alreadyIncluded(context.identity.phone) ? undefined : context.identity.phone),
    line("E-mail", alreadyIncluded(context.identity.email) ? undefined : context.identity.email),
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
