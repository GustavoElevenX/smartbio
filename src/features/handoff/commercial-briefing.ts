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
  const rawKind = context.intent.kind || (/orçament|cotaç|proposta/i.test(goal) ? "request_quote" : /agend|reserv/i.test(goal) ? "schedule" : /compr|pedido/i.test(goal) ? "buy" : "contact");
  const kind = rawKind === "reserve" ? "schedule" : rawKind === "visit" || rawKind === "learn" || rawKind === "custom" ? "other" : rawKind;
  const subject = detail ? ` sobre ${detail}` : "";
  const actions = {
    buy: `Revisar o pedido${subject} e orientar a conclusão`,
    request_quote: `Preparar a cotação${subject} com base no que foi informado`,
    schedule: `Conferir a solicitação de horário${subject} e responder ao visitante`,
    contact: `Retomar o contato${subject} pelo canal escolhido`,
    other: `Analisar a solicitação${subject} e indicar o atendimento adequado`,
  };
  const collected = visitorStatements.length ? ` Já foram informados: ${visitorStatements.map((item) => item.label).join(", ")}.` : "";
  const confirmed = confirmedFacts.length ? ` Considere os dados confirmados pela empresa: ${confirmedFacts.map((item) => item.label).join(", ")}.` : "";
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
      action: actions[kind],
      reason: pending.length
        ? `Confirme antes de prometer: ${pending.join(", ")}.${collected}${confirmed}`
        : `Confirme condições comerciais ainda não verificadas antes de prometer preço, disponibilidade ou prazo.${collected}${confirmed}`,
    },
  };
}
