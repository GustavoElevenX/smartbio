import type { CapabilityKey, DataRequirement, Project, ProjectCapability } from "@/types";

export interface CapabilityRequirementDefinition {
  key: string;
  label: string;
  required: boolean;
  question: string;
  validate(project: Project): boolean;
  actionPath: (projectId: string) => string;
}

const dataPath = (projectId: string) => `/app/projects/${projectId}/data`;

export const capabilityRequirements: Record<CapabilityKey, CapabilityRequirementDefinition[]> = {
  qualification: [
    { key: "qualification.objective", label: "Objetivo da qualificação", required: true, question: "Qual resultado a qualificação deve produzir?", validate: (p) => Boolean(p.primaryGoal), actionPath: dataPath },
    { key: "qualification.questions", label: "Perguntas de qualificação", required: true, question: "Quais perguntas ajudam a encaminhar o visitante?", validate: (p) => Boolean(p.steps.some((step) => step.type === "form" && step.formFields?.length)), actionPath: dataPath },
    { key: "qualification.outcome", label: "Saída da qualificação", required: true, question: "Qual recomendação ou encaminhamento deve aparecer?", validate: (p) => Boolean(p.steps.some((step) => step.type === "recommendation" || step.type === "action")), actionPath: dataPath },
    { key: "qualification.destination", label: "Destino final", required: true, question: "Para onde o visitante deve seguir?", validate: (p) => hasDestination(p), actionPath: dataPath },
  ],
  quote: [
    { key: "quote.services", label: "Serviços do orçamento", required: true, question: "Quais serviços podem receber orçamento?", validate: (p) => Boolean(p.commercialConfig?.quoteDefinition?.questions.length), actionPath: dataPath },
    { key: "quote.mode", label: "Modo de orçamento", required: true, question: "O orçamento será manual, exato, em faixa ou a partir de?", validate: (p) => Boolean(p.commercialConfig?.quoteDefinition?.estimationMode), actionPath: dataPath },
    { key: "quote.destination", label: "Destino do orçamento", required: true, question: "Quem receberá a solicitação?", validate: (p) => Boolean(p.commercialConfig?.quoteDefinition?.completionChannel), actionPath: dataPath },
    { key: "quote.visitor", label: "Dados do visitante", required: true, question: "Quais dados de contato são necessários?", validate: (p) => Boolean(p.businessProfile?.requiredVisitorData.length), actionPath: dataPath },
  ],
  scheduling: [
    { key: "scheduling.services", label: "Serviço e duração", required: true, question: "Qual serviço será agendado e qual é a duração?", validate: (p) => Boolean(p.commercialConfig?.schedulableServices?.some((item) => item.name && item.durationMinutes > 0)), actionPath: dataPath },
    { key: "scheduling.availability", label: "Disponibilidade e fuso horário", required: true, question: "Em quais dias e horários há atendimento?", validate: (p) => Boolean(p.commercialConfig?.availabilityRules?.some((item) => item.timezone && item.startTime && item.endTime)), actionPath: dataPath },
    { key: "scheduling.destination", label: "Confirmação e destino", required: true, question: "Como o agendamento será confirmado?", validate: (p) => Boolean(p.commercialConfig?.schedulableServices?.some((item) => item.confirmationMode)), actionPath: dataPath },
  ],
  catalog_order: [
    { key: "catalog.categories", label: "Categoria do catálogo", required: true, question: "Como seus produtos devem ser organizados?", validate: (p) => Boolean(p.commercialConfig?.catalogCategories?.length), actionPath: dataPath },
    { key: "catalog.items", label: "Itens do catálogo", required: true, question: "Quais produtos ou itens estarão disponíveis?", validate: (p) => Boolean(p.commercialConfig?.catalogItems?.length), actionPath: dataPath },
    { key: "catalog.completion", label: "Conclusão do pedido", required: true, question: "Como o pedido será concluído?", validate: (p) => hasDestination(p), actionPath: dataPath },
  ],
  reservation: [
    { key: "reservation.units", label: "Unidades reserváveis", required: true, question: "O que o visitante poderá reservar?", validate: (p) => Boolean(p.commercialConfig?.reservableUnits?.length), actionPath: dataPath },
    { key: "reservation.availability", label: "Disponibilidade de reservas", required: true, question: "Quais regras de disponibilidade devem ser usadas?", validate: (p) => Boolean(p.commercialConfig?.availabilityRules?.length), actionPath: dataPath },
    { key: "reservation.policy", label: "Política de reserva", required: true, question: "Qual é a política de confirmação e cancelamento?", validate: (p) => Boolean(p.steps.some((s) => s.blocks?.some((b) => b.type === "policy_card" && b.content?.confirmed === true))), actionPath: dataPath },
  ],
  routing: [
    { key: "routing.destinations", label: "Destinos de atendimento", required: true, question: "Quais unidades ou canais podem receber o visitante?", validate: (p) => Boolean(p.commercialConfig?.routingDestinations?.length), actionPath: dataPath },
    { key: "routing.fallback", label: "Fallback de roteamento", required: true, question: "O que deve acontecer quando nenhuma unidade for elegível?", validate: (p) => Boolean(p.commercialConfig?.routingDestinations?.some((item) => item.type === "unavailable")), actionPath: dataPath },
    { key: "routing.location", label: "Localização das unidades", required: true, question: "Quais são os endereços e coordenadas das unidades?", validate: (p) => Boolean(p.commercialConfig?.locations?.some((item) => item.latitude != null && item.longitude != null)), actionPath: dataPath },
  ],
  payment: [
    { key: "payment.url", label: "URL de pagamento", required: true, question: "Qual é a URL segura do checkout?", validate: (p) => isHttpUrl(p.commercialConfig?.paymentUrl), actionPath: dataPath },
    { key: "payment.cta", label: "CTA de pagamento", required: true, question: "Qual texto deve aparecer no botão de pagamento?", validate: (p) => Boolean(p.steps.some((step) => step.options?.some((option) => option.actionPayload?.capability === "payment" && option.label))), actionPath: dataPath },
  ],
};

function isHttpUrl(value?: string) {
  if (!value) return false;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

function hasDestination(project: Project) {
  return project.steps.some((step) => step.options?.some((option) => {
    if (option.actionType === "submit_form" || option.actionType === "finish") return true;
    if (option.actionType === "open_whatsapp") {
      const configured = project.commercialConfig?.routingDestinations?.find((destination) => destination.id === option.actionPayload?.destinationId && destination.type === "whatsapp");
      return Boolean(configured?.value || option.actionPayload?.phone || project.phone);
    }
    if (option.actionType === "open_url") return isHttpUrl(String(option.actionPayload?.url || ""));
    return option.actionType === "start_capability";
  }));
}

export function evaluateCapabilityRequirements(project: Project): DataRequirement[] {
  return (project.capabilities || []).filter((item) => item.enabled).flatMap((capability) =>
    capabilityRequirements[capability.key].map((definition) => {
      const valid = definition.validate(project);
      return {
        id: `${project.id}:${definition.key}`,
        key: definition.key,
        label: definition.label,
        capability: capability.key,
        status: valid ? "verified" : "missing",
        severity: definition.required ? "blocking" : "optional",
        reason: valid ? "Dado necessário configurado." : definition.question,
        actionLabel: valid ? undefined : "Corrigir",
        actionPath: valid ? undefined : definition.actionPath(project.id),
      } satisfies DataRequirement;
    }),
  );
}

export function draftCapabilityRequirements(capabilities: ProjectCapability[]): DataRequirement[] {
  return capabilities.filter((item) => item.enabled).flatMap((capability) => capabilityRequirements[capability.key].map((definition) => ({
    id: `requirement-${capability.key}-${definition.key.replaceAll(".", "-")}`,
    key: definition.key,
    label: definition.label,
    capability: capability.key,
    status: "missing" as const,
    severity: definition.required ? "blocking" as const : "optional" as const,
    reason: definition.question,
  })));
}
