import { describe, expect, it } from "vitest";

import { createDiscoveryPlan, discoveryPlanIsReady, discoveryPlanIssues, type DiscoveryPlanDraft } from "@/features/qualification/discovery-plan";

const offers = ["Persiana Rolô Blackout", "Persiana Romana", "Persiana Double Vision"];

function profile(name: string): DiscoveryPlanDraft["offerIntelligenceProfiles"][number] {
  const others = offers.filter((item) => item !== name);
  return {
    version: 1,
    offerName: name,
    safeDescription: `${name} é uma opção real; a adequação depende do contexto e da confirmação da equipe.`,
    compatibleNeeds: [`Necessidade contextual compatível com ${name}.`],
    relatedGoals: [`Comparar ${name} com as alternativas confirmadas.`],
    strongSignalGroups: [{ clues: [`sinal específico A de ${name}`, `sinal específico B de ${name}`], minimumMatches: 2, rationale: "Dois sinais independentes precisam convergir." }],
    supportingSignals: [`característica de ${name}`, `efeito esperado de ${name}`],
    ambiguitySignals: ["pedido amplo sem contexto"],
    exclusions: ["Não afirmar adequação sem confirmação."],
    discriminatingQuestions: [{ question: `Qual diferença de ${name} importa no ambiente?`, purpose: "signal", separatesFromOfferNames: others }],
    explanationData: [`A explicação relaciona sinais observáveis a ${name}.`],
    fallbackEligible: false,
  };
}

function draft(names = offers): DiscoveryPlanDraft {
  return {
    offerIntelligenceProfiles: names.map(profile),
    questions: [
      { id: "light", question: "Como você quer controlar a entrada de luz?", type: "textarea", purpose: "need", required: true },
      { id: "privacy", question: "Quando a privacidade é mais importante?", type: "textarea", purpose: "context", required: true },
    ],
    fallbackStrategy: { kind: "team_handoff", explanation: "Encaminhar contexto insuficiente à equipe." },
  };
}

function create(inputDraft?: DiscoveryPlanDraft, providerFailed = false) {
  return createDiscoveryPlan({
    setupSessionId: "setup-contract",
    businessName: "Casa Clara Persianas",
    businessDescription: "A Casa Clara orienta a escolha entre persianas reais conforme luz, privacidade e acabamento.",
    declaredObjective: "Ajudar o visitante a descobrir a persiana adequada",
    primaryAction: { key: "recommendation", label: "Descobrir minha persiana" },
    completionAction: { label: "Conversar com a equipe", destination: "WhatsApp" },
    offeringNames: offers,
    draft: inputDraft,
    providerFailed,
  });
}

describe("contrato persistente do DiscoveryPlan", () => {
  it("mantém bijeção exata entre ofertas e perfis com a mesma proveniência", () => {
    const plan = create(draft());
    expect(discoveryPlanIsReady(plan)).toBe(true);
    expect(discoveryPlanIssues(plan)).toEqual([]);
    expect(plan.offerings.map((item) => item.name)).toEqual(offers);
    expect(plan.offerIntelligenceProfiles.map((item) => item.offerId).toSorted()).toEqual(plan.offerings.map((item) => item.id).toSorted());
    expect(new Set(plan.offerIntelligenceProfiles.map((item) => item.provenance.discoveryPlanId))).toEqual(new Set([plan.id]));
  });

  it("bloqueia 4/5 perfis e nunca completa silenciosamente com status ready", () => {
    const fiveOffers = [...offers, "Persiana Painel", "Persiana Vertical"];
    const incomplete = { ...draft(), offerIntelligenceProfiles: fiveOffers.slice(0, 4).map((name) => ({ ...profile(offers.includes(name) ? name : offers[0]), offerName: name })) };
    const plan = createDiscoveryPlan({
      setupSessionId: "setup-incomplete",
      businessName: "Casa Clara Persianas",
      businessDescription: "Orientação entre cinco ofertas confirmadas.",
      declaredObjective: "Descobrir uma opção",
      primaryAction: { key: "recommendation", label: "Descobrir" },
      completionAction: { label: "Conversar", destination: "WhatsApp" },
      offeringNames: fiveOffers,
      draft: incomplete,
    });
    expect(plan.status).toBe("degraded");
    expect(discoveryPlanIsReady(plan)).toBe(false);
    expect(plan.issues.join(" ")).toContain("Persiana Vertical");
  });

  it("marca falha do provider como degradada e não promove placeholder determinístico", () => {
    const plan = create(undefined, true);
    expect(plan.status).toBe("degraded");
    expect(plan.provenance.source).toBe("deterministic_placeholder");
    expect(discoveryPlanIsReady(plan)).toBe(false);
  });
});
