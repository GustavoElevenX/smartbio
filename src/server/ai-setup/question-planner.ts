import type { SetupQuestion } from "@/features/ai-setup/ai-setup.schema";
import type { CapabilityKey, DataRequirement } from "@/types";

const choiceQuestions: Record<string, SetupQuestion["options"]> = {
  "quote.mode": [
    { label: "Orçamento manual", value: "manual", description: "Você analisa a solicitação antes de informar o valor." },
    { label: "Valor exato", value: "exact", description: "A jornada pode calcular um preço fechado." },
    { label: "Faixa de preço", value: "range", description: "O visitante recebe uma estimativa mínima e máxima." },
    { label: "A partir de", value: "starting_at", description: "A jornada exibe apenas o preço inicial." },
  ],
  "quote.destination": [
    { label: "WhatsApp", value: "whatsapp" },
    { label: "E-mail", value: "email" },
    { label: "Formulário interno", value: "native" },
  ],
  "catalog.completion": [
    { label: "WhatsApp", value: "whatsapp" },
    { label: "Pedido interno", value: "native" },
    { label: "Checkout externo", value: "external_url" },
  ],
  "scheduling.destination": [
    { label: "Confirmação manual", value: "manual_approval" },
    { label: "Confirmação imediata", value: "instant" },
    { label: "Agenda externa", value: "external_system" },
  ],
};

const descriptions: Record<string, string> = {
  "qualification.objective": "A Sobe inferiu este objetivo a partir do que você contou. Confirme ou ajuste.",
  "qualification.questions": "A Sobe preparou uma primeira sequência. Você poderá ajustá-la agora ou depois.",
  "qualification.outcome": "Este é o encaminhamento sugerido para o fim da orientação.",
  "qualification.destination": "A Sobe usou apenas os canais reais que você informou.",
  "qualification.offerings": "Encontramos opções explícitas no que você informou. Confirme a lista ou edite somente o que precisar.",
  "quote.services": "Liste apenas serviços reais que podem receber uma solicitação.",
  "scheduling.availability": "Exemplo: segunda a sexta, das 9h às 18h.",
  "catalog.items": "Informe itens reais. Preços e imagens podem ser completados depois.",
  "reservation.policy": "A Sobe não inventa regras: informe a política usada pelo negócio.",
  "routing.location": "Informe cidade, bairro ou endereço das unidades atendidas.",
  "payment.url": "Use apenas o endereço seguro do checkout que já existe.",
};

const humanTitles: Record<string, string> = {
  "qualification.objective": "Objetivo que a Sobe entendeu",
  "qualification.questions": "Perguntas iniciais sugeridas pela Sobe",
  "qualification.outcome": "Encaminhamento sugerido",
  "qualification.destination": "Como o atendimento vai continuar",
  "qualification.offerings": "Encontramos estas opções",
  "quote.services": "Quais serviços o cliente pode pedir orçamento por aqui?",
  "quote.mode": "Como você costuma informar o valor de um orçamento?",
  "quote.destination": "Quem deve receber o pedido de orçamento?",
  "quote.visitor": "Quais dados você precisa receber para preparar o orçamento?",
  "scheduling.services": "Quais serviços podem ser agendados e quanto tempo cada um leva?",
  "scheduling.availability": "Em quais dias e horários você atende?",
  "scheduling.destination": "Como o cliente fica sabendo que o horário foi confirmado?",
  "catalog.categories": "Como você organiza os produtos que vende?",
  "catalog.items": "Quais produtos o cliente pode ver ou pedir por aqui?",
  "catalog.completion": "Como você quer receber um pedido depois que o cliente escolher os produtos?",
  "reservation.units": "O que o visitante pode reservar?",
  "reservation.availability": "Quando essas opções ficam disponíveis para reserva?",
  "reservation.policy": "Quais são as regras de confirmação e cancelamento?",
  "routing.destinations": "Quais unidades ou canais podem receber o cliente?",
  "routing.fallback": "Se nenhuma unidade servir, como sua equipe deve continuar o atendimento?",
  "routing.location": "Onde ficam as unidades que o cliente pode encontrar?",
  "payment.url": "Qual link seguro deve abrir para o pagamento?",
  "payment.cta": "O que deve estar escrito no botão de pagamento?",
};

function questionType(requirement: DataRequirement): SetupQuestion["type"] {
  if (choiceQuestions[requirement.key]) return "single_choice";
  if (requirement.key.endsWith(".url")) return "url";
  if (requirement.key.includes("location")) return "address";
  if (["questions", "services", "offerings", "items", "availability", "policy", "destinations", "units"].some((part) => requirement.key.endsWith(`.${part}`))) return "textarea";
  return "text";
}

export function planAdaptiveQuestions(
  requirements: DataRequirement[],
  answers: Record<string, unknown>,
  limit = 3,
  suggestions: Record<string, string> = {},
  structuredSuggestions: Record<string, SetupQuestion["structuredAnswer"]> = {},
): SetupQuestion[] {
  const rank = { blocking: 0, warning: 1, optional: 2 } as const;
  const originalOrder = new Map(requirements.map((item, index) => [item.key, index]));
  return requirements
    .filter((item) => item.status !== "verified" && answers[item.key] == null)
    .sort((a, b) => rank[a.severity] - rank[b.severity] || (originalOrder.get(a.key) || 0) - (originalOrder.get(b.key) || 0))
    .slice(0, limit)
    .map((requirement, index) => ({
      id: `question-${requirement.id}`,
      key: requirement.key,
      title: humanTitles[requirement.key] || requirement.reason,
      description: descriptions[requirement.key],
      type: questionType(requirement),
      options: choiceQuestions[requirement.key],
      required: requirement.severity === "blocking",
      reason: "Essa resposta é necessária para que a ação escolhida funcione do início ao fim.",
      capability: requirement.capability === "brand" || requirement.capability === "project" ? undefined : requirement.capability as CapabilityKey,
      priority: 100 - index,
      suggestedAnswer: suggestions[requirement.key],
      structuredAnswer: structuredSuggestions[requirement.key],
    }));
}
