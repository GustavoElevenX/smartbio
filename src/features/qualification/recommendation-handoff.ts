import type { FormField } from "@/types";
import type { RecommendationConfidence } from "@/features/qualification/recommendation-engine";

const ignoredKeys = new Set(["name", "email", "phone", "company"]);

function valueText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(", ");
  return String(value ?? "").trim();
}

export function buildRecommendationHandoff(input: {
  answers: Record<string, unknown>;
  fields?: FormField[];
  serviceName?: string;
  confidence?: RecommendationConfidence;
}): { answers: Record<string, string>; closing: string } {
  if (input.serviceName && input.confidence !== "uncertain") {
    return {
      answers: { orientação_recebida: input.serviceName },
      closing: "Gostaria de confirmar essa orientação com a equipe.",
    };
  }
  const labels = new Map((input.fields || []).map((field) => [field.key, field.handoffLabel || field.label]));
  const context = Object.entries(input.answers)
    .filter(([key, value]) => !ignoredKeys.has(key) && Boolean(valueText(value)))
    .slice(0, 3)
    .map(([key, value]) => `${labels.get(key) || "Contexto"}: ${valueText(value)}`)
    .join("; ")
    .slice(0, 360);
  return {
    answers: {
      ...(context ? { contexto_informado: context } : {}),
      resultado_da_orientação: "Ainda preciso de uma avaliação da equipe para identificar a opção mais adequada.",
    },
    closing: "Gostaria de continuar a avaliação com a equipe.",
  };
}
