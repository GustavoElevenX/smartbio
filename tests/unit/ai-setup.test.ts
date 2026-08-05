import { describe, expect, it } from "vitest";
import { calculateSetupReadiness } from "@/server/ai-setup/readiness";
import { planAdaptiveQuestions } from "@/server/ai-setup/question-planner";
import type { DataRequirement } from "@/types";

const requirements: DataRequirement[] = [
  { id: "one", key: "quote.services", label: "Serviços do orçamento", capability: "quote", status: "missing", severity: "blocking", reason: "Quais serviços podem receber orçamento?" },
  { id: "two", key: "quote.mode", label: "Modo de orçamento", capability: "quote", status: "missing", severity: "blocking", reason: "Como o orçamento será calculado?" },
  { id: "three", key: "project.notes", label: "Observação", capability: "project", status: "missing", severity: "optional", reason: "Deseja adicionar uma observação?" },
];

describe("onboarding adaptativo", () => {
  it("prioriza requisitos bloqueadores, limita o lote e não repete respostas", () => {
    const first = planAdaptiveQuestions(requirements, {}, 2);
    expect(first).toHaveLength(2);
    expect(first.every((item) => item.required)).toBe(true);
    expect(first.map((item) => item.key)).toContain("quote.services");
    const next = planAdaptiveQuestions(requirements, { "quote.services": "Consultoria" }, 2);
    expect(next.map((item) => item.key)).not.toContain("quote.services");
  });

  it("expõe prontidão e pendências sem fingir que dados ausentes foram confirmados", () => {
    const readiness = calculateSetupReadiness(requirements, { initialInput: { businessName: "Aurora", description: "Consultoria financeira personalizada.", phone: "5511999999999" } });
    expect(readiness.readyToGenerate).toBe(true);
    expect(readiness.blocking).toBe(2);
    expect(readiness.progress).toBe(50);
  });
});
