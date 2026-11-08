import type { CommercialHandoffContext } from "./commercial-handoff-context";

export interface CommercialBriefing {
  projectId: string;
  businessName?: string;
  visitorGoal: string;
  visitorRequest?: string;
  visitorStatements: Array<{ label: string; value: string }>;
  confirmedFacts: Array<{ label: string; value: string }>;
  pending: string[];
  origin?: string;
  campaign?: string;
  location?: string;
  contactConsent?: boolean;
  nextStep: { action: string; reason: string };
}

export function buildCommercialBriefing(context: CommercialHandoffContext): CommercialBriefing {
  const included = context.qualification.filter((item) => item.include && item.value.trim());
  const visitorStatements = included.filter((item) => item.source !== "business_confirmed")
    .map(({ label, value }) => ({ label, value: value.trim() }));
  const confirmedFacts = included.filter((item) => item.source === "business_confirmed")
    .map(({ label, value }) => ({ label, value: value.trim() }));
  const pending = [...new Set((context.pending || []).map((item) => item.trim()).filter(Boolean))];
  const goal = context.intent.label?.trim() || "Atendimento solicitado";
  const detail = context.intent.visitorRequest?.trim();
  return {
    projectId: context.projectId,
    businessName: context.projectName?.trim() || undefined,
    visitorGoal: goal,
    visitorRequest: detail || undefined,
    visitorStatements,
    confirmedFacts,
    pending,
    origin: context.origin.source,
    campaign: context.origin.campaign,
    location: included.find((item) => /^unidade$/i.test(item.label))?.value,
    contactConsent: context.consent?.contact,
    nextStep: {
      action: "Confirmar o pedido e orientar o próximo atendimento",
      reason: pending.length
        ? `A equipe precisa confirmar: ${pending.join(", ")}.`
        : "A equipe deve confirmar condições comerciais antes de assumir preço, disponibilidade ou prazo.",
    },
  };
}
