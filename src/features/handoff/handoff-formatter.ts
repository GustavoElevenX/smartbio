import type { CommercialHandoffContext } from "./commercial-handoff-context";
import type { Project } from "@/types";
import { buildWhatsAppMessage } from "@/features/whatsapp/whatsapp";

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
    line("Versão da campanha", context.origin.activationVersion?.toString()),
  ].filter(Boolean).join("\n");
}

export function formatVisitorHandoff(context: CommercialHandoffContext, project?: Project) {
  const answers: Record<string, string> = {};
  for (const item of context.qualification) {
    if (item.include && item.value.trim()) answers[item.label] = item.value.trim();
  }
  const location = project?.commercialConfig?.locations?.find((item) => item.id === context.intent.locationId)?.name;
  if (context.identity.name && !Object.values(answers).includes(context.identity.name)) answers.Nome = context.identity.name;
  if (context.identity.phone && !Object.values(answers).includes(context.identity.phone)) answers.Telefone = context.identity.phone;
  if (context.identity.email && !Object.values(answers).includes(context.identity.email)) answers["E-mail"] = context.identity.email;
  if (context.origin.source) answers.Origem = context.origin.source;
  if (context.origin.campaign) answers.Campanha = context.origin.campaign;
  if (context.origin.activationVersion) answers["Versão da campanha"] = String(context.origin.activationVersion);
  if (context.benefit?.label) answers.Oferta = context.benefit.label;
  return buildWhatsAppMessage({
    businessName: project?.name || context.projectName,
    interest: context.intent.label,
    location,
    answers,
    benefitClaim: context.benefit?.code ? { code: context.benefit.code } : undefined,
  });
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
