import type { FormField } from "@/types";

export type VisitorIntent = "view_products" | "price_availability" | "buy" | "order" | "quote" | "resale" | "schedule" | "contact" | "support" | "other";

export interface CollectionQuestion {
  field: FormField;
  decision: string;
}

const decisions: Record<string, string> = {
  product: "Identificar o item solicitado para a equipe consultar a opção correta.",
  item: "Identificar o item solicitado para a equipe consultar a opção correta.",
  model: "Conferir a aplicação do item antes de orientar o visitante.",
  year: "Conferir a aplicação do item antes de orientar o visitante.",
  quantity: "Dimensionar o pedido e orientar uma proposta comercial.",
  volume: "Dimensionar o fornecimento e orientar a negociação.",
  region: "Verificar se a equipe atende a região informada.",
  location: "Direcionar o pedido para a unidade adequada.",
  unit: "Direcionar o pedido para a unidade adequada.",
  fulfillment: "Distinguir entrega de retirada antes do encaminhamento.",
  specialty: "Direcionar a consulta à especialidade procurada.",
  period: "Informar a preferência de horário sem prometer agenda.",
  scope: "Dimensionar o escopo do orçamento.",
  deadline: "Entender a urgência antes de preparar o orçamento.",
  need: "Entender o pedido específico para encaminhar à equipe.",
  interest: "Registrar o pedido específico antes de encaminhar à equipe.",
  negocio: "Distinguir o tipo de estabelecimento para orientar o atendimento comercial.",
  investimento: "Dimensionar a necessidade para encaminhar uma proposta adequada.",
  objetivo: "Entender o resultado esperado antes de orientar o próximo passo.",
};

const genericQuestion = /^(?:o que voce (?:mais )?(?:gostaria|precisa)|que (?:resultado|contexto) (?:seria|a equipe)|conte com suas palavras o que voce precisa)/i;
const contactField = /^(?:name|nome|phone|telefone|email|e_mail|whatsapp)$/i;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function questionDecision(field: FormField) {
  const text = normalize(`${field.key} ${field.label}`);
  for (const [signal, reason] of Object.entries(decisions)) if (text.includes(signal)) return reason;
  return contactField.test(field.key)
    ? "Permitir que a equipe retome o contato escolhido pelo visitante."
    : "Revisar com o negócio se esta resposta muda o encaminhamento.";
}

export function buildIntentCollectionPlan(input: {
  intent: VisitorIntent;
  fields: FormField[];
  answers: Record<string, unknown>;
  externalCatalogUrl?: string;
  hasCatalogItems?: boolean;
}) {
  if (input.intent === "view_products" && input.externalCatalogUrl) {
    return { directUrl: input.externalCatalogUrl, questions: [] as CollectionQuestion[], reviewRequired: false };
  }
  if (["contact", "support"].includes(input.intent) && !input.fields.length) {
    return { questions: [] as CollectionQuestion[], reviewRequired: false };
  }
  const unanswered = input.fields
    .filter((field) => !String(input.answers[field.key] ?? "").trim())
    .filter((field) => !genericQuestion.test(normalize(field.label)));
  const questions = unanswered.map((field) => ({ field, decision: questionDecision(field) }));
  const noCatalogInquiry = ["buy", "order", "price_availability"].includes(input.intent) && !input.hasCatalogItems;
  if (noCatalogInquiry && !questions.some(({ field }) => /product|item|produto|peca|peça|pedido|need|necessidade|interest/i.test(`${field.key} ${field.label}`))) {
    const field: FormField = { id: "specific-request", key: "specific_request", label: "Qual item você procura? Descreva peça, modelo e ano se souber.", type: "textarea", required: false };
    questions.unshift({ field, decision: "Identificar o pedido para a equipe consultar preço, disponibilidade e aplicação sem presumir nenhum deles." });
  }
  return { questions, reviewRequired: unanswered.some((field) => questionDecision(field).startsWith("Revisar")) || unanswered.length > 4 };
}
