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
  "qualification.objective": "Isso define o resultado que a conversa deve produzir.",
  "qualification.questions": "Separe as perguntas por vírgulas ou linhas; elas virarão campos editáveis.",
  "quote.services": "Liste apenas serviços reais que podem receber uma solicitação.",
  "scheduling.availability": "Exemplo: segunda a sexta, das 9h às 18h.",
  "catalog.items": "Você poderá completar preços e imagens no editor.",
  "reservation.policy": "Não inventaremos regras: informe a política usada pelo negócio.",
  "routing.location": "Informe cidade, bairro ou endereço das unidades atendidas.",
  "payment.url": "Use apenas o endereço seguro do checkout que já existe.",
};

function questionType(requirement: DataRequirement): SetupQuestion["type"] {
  if (choiceQuestions[requirement.key]) return "single_choice";
  if (requirement.key.endsWith(".url")) return "url";
  if (requirement.key.includes("location")) return "address";
  if (["questions", "services", "items", "availability", "policy", "destinations", "units"].some((part) => requirement.key.endsWith(`.${part}`))) return "textarea";
  return "text";
}

export function planAdaptiveQuestions(
  requirements: DataRequirement[],
  answers: Record<string, unknown>,
  limit = 5,
): SetupQuestion[] {
  const rank = { blocking: 0, warning: 1, optional: 2 } as const;
  return requirements
    .filter((item) => item.status !== "verified" && answers[item.key] == null)
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit)
    .map((requirement, index) => ({
      id: `question-${requirement.id}`,
      key: requirement.key,
      title: requirement.reason,
      description: descriptions[requirement.key],
      type: questionType(requirement),
      options: choiceQuestions[requirement.key],
      required: requirement.severity === "blocking",
      reason: `Necessário para configurar ${requirement.label.toLocaleLowerCase("pt-BR")}.`,
      capability: requirement.capability === "brand" || requirement.capability === "project" ? undefined : requirement.capability as CapabilityKey,
      priority: 100 - index,
    }));
}
