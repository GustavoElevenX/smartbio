import { describe, expect, it } from "vitest";
import { buildCommercialBriefing } from "@/features/handoff/commercial-briefing";
import type { CommercialHandoffContext } from "@/features/handoff/commercial-handoff-context";
import { selectDynamicHomeCandidate, type DynamicHomeCandidate } from "@/features/activations/dynamic-home-contract";
import { confirmedHandoffFacts } from "@/features/handoff/confirmed-handoff-facts";
import type { Project } from "@/types";

const base: CommercialHandoffContext = {
  projectId: "project", origin: { source: "instagram", campaign: "novembro" }, identity: {},
  intent: { label: "Atendimento" }, qualification: [],
};

describe("Fase 4A: briefing comercial", () => {
  it.each([
    ["buy", "pedido"], ["request_quote", "cotação"], ["schedule", "horário"], ["contact", "contato"],
  ] as const)("recomenda uma ação própria para %s", (kind, expected) => {
    const briefing = buildCommercialBriefing({ ...base, intent: { kind, label: "Interesse informado" } });
    expect(briefing.nextStep.action).toContain(expected);
    expect(briefing.campaign).toBe("novembro");
  });

  it("distingue o que o visitante disse, o confirmado e o que falta verificar", () => {
    const briefing = buildCommercialBriefing({ ...base,
      intent: { kind: "request_quote", label: "Cotação", visitorRequest: "instalação" },
      qualification: [
        { label: "Volume", value: "500", include: true, source: "visitor" },
        { label: "Área atendida", value: "São Paulo", include: true, source: "business_confirmed" },
        { label: "Nota privada", value: "ignorar", include: false },
      ], pending: ["prazo", "preço", "prazo"],
    });
    expect(briefing.nextStep.action).toContain("instalação");
    expect(briefing.nextStep.reason).toContain("prazo, preço");
    expect(briefing.nextStep.reason).toContain("Volume");
    expect(briefing.nextStep.reason).toContain("Área atendida");
    expect(briefing.nextStep.reason).not.toContain("ignorar");
    expect(briefing.confirmedFacts).toEqual([{ label: "Área atendida", value: "São Paulo" }]);
  });
  it("usa somente entidades operacionais existentes como fatos confirmados", () => {
    const project = { commercialConfig: { catalogItems: [{ id: "real", name: "Produto real" }], serviceOfferings: [], locations: [{ id: "unit", name: "Unidade Centro", isActive: true }] } } as unknown as Project;
    expect(confirmedHandoffFacts(project, { productIds: ["real", "inventado"], locationId: "unit" })).toEqual([
      { label: "Produtos selecionados", value: "Produto real", include: true, source: "business_confirmed" },
      { label: "Unidade", value: "Unidade Centro", include: true, source: "business_confirmed" },
    ]);
  });
});

function candidate(id: string, priority: number, publishedAt: string, overrides: Partial<DynamicHomeCandidate> = {}): DynamicHomeCandidate {
  return { snapshot: { activationId: id, activationKey: id, priority, publishedAt,
    dynamicSurface: { mode: "exclusive_and_home", experienceKey: id, title: id, conversionGoalId: "goal", sections: [] },
  }, status: "active", ...overrides };
}

describe("Fase 4B: contrato de seleção, ainda sem roteamento", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("usa prioridade, publicação e ID para desempate estável", () => {
    expect(selectDynamicHomeCandidate([candidate("b", 2, now.toISOString()), candidate("a", 3, now.toISOString())], now)?.snapshot.activationId).toBe("a");
    expect(selectDynamicHomeCandidate([candidate("a", 2, "2026-11-09T12:00:00Z"), candidate("b", 2, now.toISOString())], now)?.snapshot.activationId).toBe("b");
    expect(selectDynamicHomeCandidate([candidate("b", 2, now.toISOString()), candidate("a", 2, now.toISOString())], now)?.snapshot.activationId).toBe("a");
  });
  it("ignora campanhas exclusivas, pausadas e fora do período", () => {
    const exclusive = candidate("exclusive", 10, now.toISOString());
    exclusive.snapshot.dynamicSurface.mode = "exclusive";
    const future = candidate("future", 8, now.toISOString());
    future.snapshot.startsAt = "2026-11-11T12:00:00Z";
    expect(selectDynamicHomeCandidate([exclusive, future, candidate("paused", 9, now.toISOString(), { status: "paused" })], now)).toBeNull();
  });
});
