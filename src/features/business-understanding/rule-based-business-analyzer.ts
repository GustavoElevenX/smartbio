import type {
  BusinessCapabilityProfile,
  CapacityKind,
  CommercialIntent,
  CompletionChannel,
  ExperienceCompositionInput,
  OfferKind,
} from "@/types";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matches(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function channelFromDestination(destination: string): CompletionChannel {
  const value = normalized(destination);
  if (value.includes("whatsapp")) return "whatsapp";
  if (value.includes("email") || value.includes("e-mail")) return "email";
  if (value.includes("telefone")) return "phone";
  if (value.includes("link") || value.includes("checkout") || value.includes("extern")) return "external_url";
  return "native";
}

const signalGroups: Array<{ kind: OfferKind; terms: string[]; reason: string }> = [
  { kind: "hospitality", terms: ["pousada", "chale", "hotel", "hospedagem", "acomodacao", "quarto", "diaria"], reason: "A descrição indica hospedagem ou acomodação." },
  { kind: "rental", terms: ["aluguel", "alugar", "locacao", "quadra", "equipamento", "salao de festas", "espaco para evento", "estudio"], reason: "A oferta depende de um recurso reservável." },
  { kind: "physical_product", terms: ["delivery", "restaurante", "loja", "produto", "cardapio", "encomenda", "combo", "kit", "varejo"], reason: "Há produtos físicos ou pedidos." },
  { kind: "digital_product", terms: ["curso online", "ebook", "infoproduto", "produto digital", "download"], reason: "Há uma oferta digital comercializável." },
  { kind: "event", terms: ["evento", "ingresso", "workshop", "palestra", "congresso", "inscricao"], reason: "A oferta inclui evento ou inscrição." },
  { kind: "membership", terms: ["assinatura", "membro", "mensalidade", "comunidade"], reason: "A oferta é recorrente ou por associação." },
  { kind: "content", terms: ["conteudo", "newsletter", "podcast", "canal"], reason: "Conteúdo é parte central da oferta." },
  { kind: "professional_service", terms: ["consultoria", "agencia", "clinica", "terapia", "nutricao", "odontologia", "advocacia", "contabilidade", "software", "mentoria", "profissional"], reason: "A descrição indica serviço profissional." },
  { kind: "service", terms: ["limpeza", "manutencao", "instalacao", "assistencia", "fotografia", "construcao", "reparo", "servico"], reason: "A descrição indica execução de serviço." },
];

export class RuleBasedBusinessAnalyzer {
  analyze(input: ExperienceCompositionInput): BusinessCapabilityProfile {
    const text = normalized([input.businessDescription, input.category, input.primaryGoal, input.audience].filter(Boolean).join(" "));
    const reasons: string[] = [];
    const inferredKinds = signalGroups.filter((group) => matches(text, group.terms));
    inferredKinds.forEach((group) => reasons.push(group.reason));
    let offerKinds = input.offerKinds?.length ? input.offerKinds : inferredKinds.map((group) => group.kind);
    if (!offerKinds.length) offerKinds = ["service"];
    offerKinds = unique(offerKinds);
    if (offerKinds.length > 1 && !offerKinds.includes("mixed")) offerKinds.push("mixed");

    const isHospitality = offerKinds.includes("hospitality") || offerKinds.includes("rental");
    const isProduct = offerKinds.includes("physical_product") || offerKinds.includes("digital_product");
    const isProfessional = offerKinds.includes("professional_service");
    const isLocalService = offerKinds.includes("service");
    const schedulingSignals = matches(text, ["agenda", "agendar", "consulta", "horario", "reuniao", "aula", "visita"]);
    const quoteSignals = matches(text, ["orcamento", "avaliacao", "sob medida", "medida", "proposta", "limpeza", "manutencao"]);
    const multipleLocationSignals = matches(text, ["unidades", "filiais", "franquias", "multiplas unidades", "varias unidades", "mais perto", "unidade mais proxima", "canais de atendimento"]);
    const photoSignals = matches(text, ["foto", "imagem", "estofado", "avaria", "avaliacao visual"]);

    const inferredPrimary: CommercialIntent[] = [];
    if (isHospitality) inferredPrimary.push("check_availability", "reserve");
    if (isProduct) inferredPrimary.push(offerKinds.includes("physical_product") ? "order" : "buy");
    if (isLocalService || quoteSignals) inferredPrimary.push("request_quote");
    if (schedulingSignals) inferredPrimary.push("schedule");
    if (isProfessional && !schedulingSignals) inferredPrimary.push("request_proposal");
    if (offerKinds.includes("event")) inferredPrimary.push("register");
    const primaryIntents = unique<CommercialIntent>(input.primaryIntents?.length ? input.primaryIntents : inferredPrimary.length ? inferredPrimary : ["contact"]);
    const secondaryIntents = unique<CommercialIntent>(input.secondaryIntents || ["contact", ...(isProfessional ? ["request_proposal" as const] : [])]).filter((intent) => !primaryIntents.includes(intent));

    const capacityKinds: CapacityKind[] = [...(input.capacityKinds || [])];
    if (!input.capacityKinds?.length) {
      if (schedulingSignals) capacityKinds.push("time_slot", ...(matches(text, ["profissional", "medico", "dentista", "terapeuta"]) ? ["professional" as const] : []));
      if (offerKinds.includes("hospitality")) capacityKinds.push("room");
      if (offerKinds.includes("rental")) capacityKinds.push("asset");
      if (isProduct) capacityKinds.push("inventory");
      if (multipleLocationSignals) capacityKinds.push("location");
    }
    if (!capacityKinds.length) capacityKinds.push("none");

    const hasMultipleLocations = input.hasMultipleLocations ?? multipleLocationSignals;
    const requiresQualification = input.requiresQualification ?? (isProfessional || quoteSignals);
    const requiresMediaUpload = input.requiresMediaUpload ?? (photoSignals || (isLocalService && quoteSignals));
    const requiresPayment = input.requiresPayment ?? primaryIntents.some((intent) => intent === "buy" || intent === "pay_deposit");
    const confirmationMode = input.confirmationMode || (isProduct && !isHospitality ? "instant" : "manual_approval");
    const requiredVisitorData = unique(input.requiredVisitorData || ["name", "phone", ...(isProfessional ? ["email", "company"] : []), ...(hasMultipleLocations ? ["location"] : [])]);

    if (quoteSignals) reasons.push("A operação precisa coletar contexto antes de confirmar preço.");
    if (schedulingSignals) reasons.push("A próxima ação depende de disponibilidade de horário.");
    if (hasMultipleLocations) reasons.push("O visitante precisa ser direcionado para o destino correto.");

    return {
      offerKinds,
      primaryIntents,
      secondaryIntents,
      confirmationMode,
      capacityKinds: unique(capacityKinds),
      hasMultipleLocations,
      requiresQualification,
      requiresMediaUpload,
      requiresPayment,
      allowsCancellationRequest: input.allowsCancellationRequest ?? (isHospitality || schedulingSignals),
      allowsRescheduleRequest: input.allowsRescheduleRequest ?? schedulingSignals,
      completionChannel: input.completionChannel || channelFromDestination(input.primaryDestination),
      requiredVisitorData,
      businessRules: input.businessRules || [],
      analysisMetadata: {
        source: input.offerKinds?.length || input.primaryIntents?.length ? "user" : "rules",
        confidence: Math.min(0.96, 0.62 + Math.min(5, reasons.length) * 0.065),
        reasons: reasons.length ? unique(reasons) : ["Perfil conservador aplicado por ausência de sinais específicos."],
        analyzedAt: new Date().toISOString(),
      },
    };
  }
}
