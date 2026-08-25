import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { buildQualificationQuestionPlan } from "@/features/ai-setup/qualification-proposal";
import { applyVisitorActionsToProject, defaultVisitorActions, ensureVisitorActionTargets } from "@/features/ai-setup/visitor-actions";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { unsupportedCapabilityReferences } from "@/features/capabilities/capability-provenance";
import { buildRecommendationHandoff } from "@/features/qualification/recommendation-handoff";
import { recommendService } from "@/features/qualification/recommendation-engine";
import { offerIntelligenceFor, offerIntelligenceProfileSchema } from "@/features/qualification/offer-intelligence";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import type { Project } from "@/types";
import { attachEngineFixtureProfiles, type OfferIntelligenceFixture } from "../fixtures/offer-intelligence";

const loopDescription = `Assistência técnica de celulares.
Serviços:
- Troca de tela
- Troca de bateria
- Avaliação do conector de carga
- Correção de problemas de software
- Diagnóstico técnico
Objetivo: orientar pelo sintoma e depois encaminhar para WhatsApp.`;

const petDescription = `PetCare Banho & Tosa atende cuidados de pelagem para pets.
Ofertas:
- Banho
- Tosa higiênica
- Tosa completa
- Hidratação de pelagem
- Avaliação antes do serviço
Objetivo: o proprietário explica o que precisa e recebe orientação antes do contato.`;

const loopFixtures: Record<string, OfferIntelligenceFixture> = {
  "troca de tela": {
    strongClues: ["caiu", "vidro da frente trincado", "continua ligando"],
    supporting: ["dano visível na frente", "tela trincada"],
    question: "Qual problema você percebe no aparelho?",
    explanation: "A queda e o dano visível na parte frontal tornam a avaliação dessa oferta um caminho compatível, sem afirmar dano interno.",
  },
  "troca de bateria": {
    strongClues: ["bateria acaba", "várias vezes por dia", "descarrega rapidamente"],
    supporting: ["baixa duração da carga"],
    question: "A carga termina rápido mesmo depois de carregar?",
    explanation: "A duração muito curta da carga é um sinal observável compatível com a avaliação dessa oferta.",
  },
  "avaliacao do conector de carga": {
    strongClues: ["carrega quando mexe no cabo", "cabo em determinada posição", "carregamento muda com o cabo"],
    supporting: ["carregamento instável"],
    question: "O carregamento muda quando o cabo é movimentado?",
    explanation: "A mudança no carregamento ao movimentar o cabo justifica avaliar essa oferta, sem concluir qual peça está com problema.",
  },
  "correcao de problemas de software": {
    strongClues: ["aplicativos fecham", "sistema trava"],
    supporting: ["problema no funcionamento do sistema"],
    question: "O problema aparece em aplicativos ou no funcionamento do sistema?",
  },
  "diagnostico tecnico": {
    supporting: ["problema ainda indefinido"],
    ambiguity: ["celular estranho", "sintoma indefinido", "não sabe explicar"],
    fallbackEligible: true,
    question: "Você consegue indicar algum sinal mais específico?",
    explanation: "Como o sintoma ainda é amplo, o diagnóstico oferecido pelo negócio é um próximo passo conservador.",
  },
};

const petFixtures: Record<string, OfferIntelligenceFixture> = {
  banho: {
    strongClues: ["pelo sujo", "odor forte", "precisa de limpeza"],
    supporting: ["limpeza da pelagem"],
    question: "Qual cuidado você percebe que o pet precisa agora?",
    explanation: "Sujeira e odor na pelagem tornam o banho uma possibilidade compatível para confirmação da equipe.",
  },
  "tosa higienica": {
    supporting: ["aparar regiões de higiene", "sem mudar o restante do pelo"],
    question: "O cuidado é apenas em regiões de higiene?",
    explanation: "O pedido limitado às regiões de higiene se relaciona a essa oferta sem pressupor uma tosa mais ampla.",
  },
  "tosa completa": {
    strongClues: ["reduzir todo o pelo", "tosa no corpo inteiro"],
    supporting: ["mudança geral no comprimento da pelagem"],
    question: "Você pretende reduzir o pelo no corpo todo?",
  },
  "hidratacao de pelagem": {
    strongClues: ["pelagem ressecada", "pelo sem maciez"],
    supporting: ["cuidado com ressecamento da pelagem"],
    question: "A pelagem parece ressecada ou sem maciez?",
  },
  "avaliacao antes do servico": {
    supporting: ["precisa de orientação antes do cuidado"],
    ambiguity: ["não sei qual cuidado", "necessidade indefinida"],
    fallbackEligible: true,
    question: "Há algum detalhe do pet que a equipe deve avaliar antes?",
    explanation: "Como a necessidade ainda não está clara, a avaliação que o negócio realmente oferece é um caminho conservador.",
  },
};

function discoveryProject(input: {
  name: string;
  description: string;
  phone: string;
  fixtures: Record<string, OfferIntelligenceFixture>;
}) {
  const compositionInput = {
    businessName: input.name,
    businessDescription: input.description,
    primaryGoal: "Criar presença",
    primaryDestination: "WhatsApp",
    slug: input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
    phone: input.phone,
  };
  const profile = new RuleBasedBusinessAnalyzer().analyze(compositionInput);
  const actions = defaultVisitorActions(profile, input.description);
  const base = new RuleBasedExperienceComposer().compose({ ...compositionInput, primaryGoal: actions[0].label });
  const qualificationStep = base.steps.find((step) => step.type === "form");
  const actionStep = base.steps.find((step) => step.type === "action");
  const choiceStep = base.steps.find((step) => step.type === "choice");
  const scoped: Project = {
    ...base,
    capabilities: base.capabilities?.filter((capability) => capability.key === "qualification"),
    commercialConfig: { qualificationRules: [] },
    dataRequirements: [],
    steps: base.steps
      .filter((step) => ["welcome", "choice"].includes(step.type) || step.id === qualificationStep?.id || step.id === actionStep?.id)
      .map((step) => step.id === choiceStep?.id ? { ...step, options: step.options?.filter((option) => option.value === "qualification") } : step),
  };
  const explicitOffers = input.description.match(/(?:Serviços|Ofertas):([\s\S]*?)Objetivo:/i)?.[1]
    ?.split(/\r?\n/).map((line) => line.replace(/^\s*-\s*/, "").trim()).filter(Boolean) || [];
  const session: AISetupSession = {
    id: `v6-${compositionInput.slug}`,
    workspaceId: "workspace",
    status: "review",
    initialInput: { businessName: input.name, description: input.description, phone: input.phone },
    visitorActions: actions,
    actionsConfirmed: true,
    answers: {
      "qualification.objective": "Entender o relato e orientar uma oferta compatível antes do contato.",
      // Simula uma etapa intermediária parcial: o último item explícito não pode desaparecer.
      "qualification.offerings": explicitOffers.slice(0, -1).join("\n"),
      "qualification.questions": "O que você precisa resolver?",
      "qualification.outcome": "Apresentar uma possibilidade conservadora e continuar com a equipe.",
      "qualification.destination": "WhatsApp",
    },
    missingRequirements: [], questions: [], sources: [], usedFallback: false,
    createdAt: "2026-08-25T00:00:00.000Z", updatedAt: "2026-08-25T00:00:00.000Z",
  };
  let project = materializeSetupAnswers(scoped, session);
  project = attachEngineFixtureProfiles(project, input.fixtures);
  project = materializeSetupAnswers(project, session);
  project = ensureVisitorActionTargets(project, actions);
  project = applyVisitorActionsToProject(project, { visitorActions: actions });
  return { project, actions };
}

describe("Activation V6 — Offer Intelligence contextual", () => {
  const loop = () => discoveryProject({ name: "LoopCell Assistência", description: loopDescription, phone: "5511987654321", fixtures: loopFixtures });
  const pet = () => discoveryProject({ name: "PetCare Banho & Tosa", description: petDescription, phone: "5511987654321", fixtures: petFixtures });

  it("propõe discovery como ação principal e preserva todas as ofertas explícitas", () => {
    const { project, actions } = loop();
    expect(actions[0]).toMatchObject({ key: "recommendation", isPrimary: true });
    expect(actions.some((action) => action.key === "contact" && !action.isPrimary)).toBe(true);
    expect(project.commercialConfig?.serviceOfferings?.map((offer) => offer.name)).toEqual([
      "Troca de tela", "Troca de bateria", "Avaliação do conector de carga", "Correção de problemas de software", "Diagnóstico técnico",
    ]);
  });

  it("persiste um profile íntegro e com proveniência por oferta", () => {
    const { project } = loop();
    const profiles = (project.commercialConfig?.serviceOfferings || []).map(offerIntelligenceFor);
    expect(profiles).toHaveLength(5);
    expect(profiles.every((profile) => offerIntelligenceProfileSchema.safeParse(profile).success)).toBe(true);
    expect(profiles.every((profile) => profile?.provenance.projectId === project.id && profile.provenance.source === "business_confirmed")).toBe(true);
    expect(profiles.map((profile) => profile?.offerId)).toEqual(project.commercialConfig?.serviceOfferings?.map((offering) => offering.id));
  });

  it.each([
    ["Caiu e o vidro da frente ficou completamente trincado, mas continua ligando.", "Troca de tela"],
    ["A bateria acaba várias vezes por dia.", "Troca de bateria"],
    ["Só carrega quando mexo no cabo ou deixo em determinada posição.", "Avaliação do conector de carga"],
  ])("calcula strong evidence por convergência na LoopCell: %s", (answer, expected) => {
    const { project } = loop();
    const result = recommendService({ symptom: answer }, project.commercialConfig?.serviceOfferings || []);
    expect(result).toMatchObject({ confidence: "clear", strongEvidence: true, service: { name: expected } });
    expect(result.reason).toContain(answer.replace(/[.!?]+$/g, ""));
    expect(result.reason).not.toMatch(/serviço de troca de|necessariamente quebrado|lcd|touch/i);
  });

  it("mantém ambiguidade segura e usa diagnóstico somente quando ele existe como oferta", () => {
    const { project } = loop();
    const result = recommendService({ symptom: "Meu celular está estranho." }, project.commercialConfig?.serviceOfferings || []);
    expect(result).toMatchObject({ confidence: "possible", service: { name: "Diagnóstico técnico" }, strongEvidence: false });
    const withoutDiagnostic = (project.commercialConfig?.serviceOfferings || []).filter((offer) => offer.name !== "Diagnóstico técnico");
    expect(recommendService({ symptom: "Meu celular está estranho." }, withoutDiagnostic).service).toBeUndefined();
  });

  it("deriva perguntas diferentes entre segmentos e materializa progressão", () => {
    const loopProject = loop().project;
    const petProject = pet().project;
    const loopForm = loopProject.steps.find((step) => step.type === "form");
    const petForm = petProject.steps.find((step) => step.type === "form");
    expect(loopForm?.formFields?.[0].label).toBe("Qual problema você percebe no aparelho?");
    expect(petForm?.formFields?.[0].label).toBe("Qual cuidado você percebe que o pet precisa agora?");
    expect(loopForm?.formFields).not.toEqual(petForm?.formFields);
    expect(loopForm?.settings).toMatchObject({ progressiveQuestioning: true, journeyMode: "assisted_discovery" });
    expect(readFileSync("src/components/public-experience/public-experience.tsx", "utf8")).toContain("selectNextQualificationQuestion");
  });

  it("não injeta uma sequência universal antes da composição contextual", () => {
    const action = [{ key: "recommendation" as const, label: "Receber orientação", isPrimary: true }];
    const loopPlan = buildQualificationQuestionPlan({
      initialInput: { businessName: "LoopCell Assistência", description: loopDescription },
      visitorActions: action,
      answers: {},
    });
    const petPlan = buildQualificationQuestionPlan({
      initialInput: { businessName: "PetCare Banho & Tosa", description: petDescription },
      visitorActions: action,
      answers: {},
    });
    expect(loopPlan[0].question).toContain("troca de tela");
    expect(petPlan[0].question).toContain("banho");
    expect(loopPlan).not.toEqual(petPlan);
  });

  it("generaliza para PetCare em caso forte, intermediário e ambíguo", () => {
    const { project } = pet();
    const offerings = project.commercialConfig?.serviceOfferings || [];
    expect(recommendService({ need: "O pelo está sujo, com odor forte, e precisa de limpeza." }, offerings)).toMatchObject({ confidence: "clear", service: { name: "Banho" } });
    expect(recommendService({ need: "Quero aparar apenas regiões de higiene, sem mudar o restante do pelo." }, offerings)).toMatchObject({ service: { name: "Tosa higiênica" } });
    expect(recommendService({ need: "Não sei qual cuidado é melhor para meu pet." }, offerings)).toMatchObject({ confidence: "possible", service: { name: "Avaliação antes do serviço" } });
  });

  it("mantém o relato original no WhatsApp em recomendação e fallback", () => {
    const fields = loop().project.steps.find((step) => step.type === "form")?.formFields || [];
    const success = buildRecommendationHandoff({ answers: { qualification_1: "A bateria acaba várias vezes por dia." }, fields, serviceName: "Troca de bateria", confidence: "clear" });
    const fallback = buildRecommendationHandoff({ answers: { qualification_1: "Meu celular está estranho." }, fields, confidence: "uncertain" });
    expect(success.answers.contexto_informado).toContain("A bateria acaba várias vezes por dia");
    expect(success.answers.orientação_recebida).toContain("Troca de bateria");
    expect(fallback.answers.contexto_informado).toContain("Meu celular está estranho");
  });

  it("readiness bloqueia perda, profile ausente, ação contraditória e jornada fixa", () => {
    const { project } = loop();
    expect(validateConversionPath(project).complete).toBe(true);
    expect(getProjectReadiness(project).blocking.filter((issue) => issue.key.startsWith("conversion-path"))).toHaveLength(0);

    const lost = structuredClone(project);
    lost.commercialConfig?.serviceOfferings?.pop();
    expect(validateConversionPath(lost).checks.find((check) => check.key === "offer_integrity")?.valid).toBe(false);

    const withoutProfile = structuredClone(project);
    if (withoutProfile.commercialConfig?.serviceOfferings?.[0]) delete withoutProfile.commercialConfig.serviceOfferings[0].settings.offerIntelligence;
    expect(validateConversionPath(withoutProfile).checks.find((check) => check.key === "result_quality")?.valid).toBe(false);

    const wrongPrimary = structuredClone(project);
    const primary = wrongPrimary.conversionGoals?.find((goal) => goal.isPrimary);
    if (primary) primary.name = "Falar no WhatsApp";
    expect(validateConversionPath(wrongPrimary).checks.find((check) => check.key === "primary_action")?.valid).toBe(false);

    const fixed = structuredClone(project);
    const form = fixed.steps.find((step) => step.type === "form");
    if (form) form.settings = { ...form.settings, progressiveQuestioning: false };
    expect(validateConversionPath(fixed).checks.find((check) => check.key === "progressive_questioning")?.valid).toBe(false);
  });

  it("não materializa disponibilidade ou outra capability sem proveniência", () => {
    for (const project of [loop().project, pet().project]) {
      expect(project.capabilities?.some((capability) => capability.key === "scheduling")).toBe(false);
      expect(JSON.stringify(project)).not.toMatch(/disponibilidade de hor[aá]rio/i);
      expect(unsupportedCapabilityReferences(project)).toHaveLength(0);
    }
  });

  it("mantém proteção mobile para nomes e cards longos", () => {
    const presence = readFileSync("src/components/public-presence/presence-section-renderer.tsx", "utf8");
    const action = readFileSync("src/components/public-presence/presence-action-button.tsx", "utf8");
    const journey = readFileSync("src/components/public-experience/public-experience.tsx", "utf8");
    expect(presence).toContain("grid-cols-1 sm:grid-cols-2");
    expect(presence).toContain("[hyphens:none]");
    expect(action).toContain("max-w-full");
    expect(journey).toContain("truncate text-center");
  });
});
