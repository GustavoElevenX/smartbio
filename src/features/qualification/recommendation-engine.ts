import type { ServiceOffering } from "@/types";

const stopwords = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em",
  "mais", "o", "os", "para", "por", "que", "um", "uma", "no", "na", "nos", "nas",
]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function tokens(value: string) {
  return new Set(
    normalize(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopwords.has(token)),
  );
}

function answerText(answers: Record<string, unknown>) {
  return Object.values(answers)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export type RecommendationConfidence = "clear" | "possible" | "uncertain";

export interface ServiceRecommendation {
  service?: ServiceOffering;
  confidence: RecommendationConfidence;
  label: string;
  title: string;
  reason: string;
}

export function recommendService(
  answers: Record<string, unknown>,
  offerings: ServiceOffering[],
): ServiceRecommendation {
  const active = offerings.filter((offering) => offering.isActive);
  const combined = answerText(answers);
  const normalizedAnswers = normalize(combined);
  const answerTokens = tokens(combined);
  const ranked = active.map((service) => {
    const exact = normalizedAnswers.includes(normalize(service.name));
    const serviceTokens = tokens(`${service.name} ${service.shortDescription || ""} ${service.description || ""}`);
    const overlap = [...serviceTokens].filter((token) => answerTokens.has(token)).length;
    return { service, score: (exact ? 100 : 0) + overlap * 10 + (service.isFeatured ? 1 : 0) };
  }).toSorted((a, b) => b.score - a.score || a.service.order - b.service.order);
  const best = ranked[0];

  if (!best || best.score <= 1) {
    return {
      confidence: "uncertain",
      label: "Orientação inicial",
      title: "Vale conversar com a equipe antes de escolher",
      reason: "Suas respostas ajudam a preparar a conversa, mas ainda não apontam com segurança para uma única opção.",
    };
  }

  const confidence: RecommendationConfidence = best.score >= 100 ? "clear" : "possible";
  return {
    service: best.service,
    confidence,
    label: confidence === "clear" ? "Boa compatibilidade" : "Possibilidade relevante",
    title: `${best.service.name} pode fazer sentido`,
    reason: confidence === "clear"
      ? "Essa opção combina diretamente com o que você indicou nas respostas."
      : "Entre as opções disponíveis, esta parece próxima do contexto que você descreveu.",
  };
}
