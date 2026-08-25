import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { buildQualificationQuestionPlan, buildQualificationSuggestions } from "@/features/ai-setup/qualification-proposal";
import { applyVisitorActionsToProject, defaultVisitorActions, ensureVisitorActionTargets, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { unsupportedCapabilityReferences } from "@/features/capabilities/capability-provenance";
import { buildRecommendationHandoff } from "@/features/qualification/recommendation-handoff";
import { recommendService } from "@/features/qualification/recommendation-engine";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { suggestSiteStructure } from "@/features/site-composer/site-structure-suggester";
import type { Project, StructuredJourneyQuestion } from "@/types";

const recommendationAction: VisitorActionSelection = { key: "recommendation", label: "Receber uma recomendação", isPrimary: true };

const structuredQuestions: StructuredJourneyQuestion[] = [
  { id: "need", question: "O que está acontecendo e o que você precisa resolver?", type: "textarea", purpose: "need", required: true },
  { id: "signal", question: "Qual situação mais se aproxima do que você percebe?", type: "textarea", purpose: "signal", required: true },
];

function projectFrom(input: { name: string; description: string; phone?: string }) {
  const base = new RuleBasedExperienceComposer().compose({
    businessName: input.name,
    businessDescription: input.description,
    primaryGoal: recommendationAction.label,
    primaryDestination: input.phone ? "WhatsApp" : "Formulário",
    slug: input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
    phone: input.phone,
  });
  const qualificationStep = base.steps.find((step) => step.type === "form");
  const actionStep = base.steps.find((step) => step.type === "action");
  const choiceStep = base.steps.find((step) => step.type === "choice");
  const scoped: Project = {
    ...base,
    capabilities: base.capabilities?.filter((capability) => capability.key === "qualification"),
    commercialConfig: { qualificationRules: [] },
    dataRequirements: [],
    steps: base.steps.filter((step) => ["welcome", "choice"].includes(step.type) || step.id === qualificationStep?.id || step.id === actionStep?.id).map((step) => step.id === choiceStep?.id
      ? { ...step, options: step.options?.filter((option) => option.value === "qualification") }
      : step),
  };
  const session: AISetupSession = {
    id: `setup-${input.name}`,
    workspaceId: "workspace",
    status: "review",
    initialInput: { businessName: input.name, description: input.description, phone: input.phone },
    visitorActions: [recommendationAction],
    actionsConfirmed: true,
    answers: {
      "qualification.objective": "Entender a situação e orientar a opção mais adequada.",
      "qualification.questions": structuredQuestions,
      "qualification.outcome": "Apresentar uma opção real quando houver evidência suficiente e continuar com a equipe.",
      "qualification.destination": input.phone ? "WhatsApp" : "Formulário",
    },
    missingRequirements: [],
    questions: [],
    sources: [],
    usedFallback: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  };
  let project = materializeSetupAnswers(scoped, session);
  project = ensureVisitorActionTargets(project, [recommendationAction]);
  return applyVisitorActionsToProject(project, { visitorActions: [recommendationAction] });
}

const arvivaDescription = "Climatização e manutenção de ar-condicionado. Serviços: Instalação de ar-condicionado; Higienização preventiva; Manutenção preventiva para empresas; Avaliação de baixo rendimento/refrigeração; Reparo de ar-condicionado. Objetivo: o visitante descreve sua situação, recebe orientação e segue para o WhatsApp.";
const bikeDescription = "Assistência para bicicletas. Serviços: Revisão completa; Ajuste de freios; Ajuste de câmbio; Troca de pneus/câmaras; Montagem de bicicleta nova. Objetivo: o visitante descreve o que acontece com a bicicleta, recebe orientação e fala com a equipe.";

describe("Activation V5 — confiabilidade da primeira versão", () => {
  it("isola gerações sequenciais nos dois sentidos e mantém proveniência por projeto", () => {
    const automotive = projectFrom({ name: "Oficina Um", description: "Estética automotiva. Serviços: Higienização interna; Polimento técnico; Revitalização de faróis." });
    const climate = projectFrom({ name: "Clima Dois", description: arvivaDescription });
    const climateCopy = JSON.stringify(climate).toLowerCase();
    expect(climateCopy).not.toMatch(/bancos|carpetes|veículo|celebraç|convidados/);
    expect(climate.commercialConfig?.serviceOfferings?.every((offer) => (offer.settings?.copyProvenance as { projectId?: string })?.projectId === climate.id)).toBe(true);

    const bike = projectFrom({ name: "Pedal Livre Bike Shop", description: bikeDescription });
    const automotiveAgain = projectFrom({ name: "Oficina Três", description: "Estética automotiva. Serviços: Higienização interna; Polimento técnico; Revitalização de faróis." });
    expect(JSON.stringify(bike).toLowerCase()).not.toMatch(/ar-condicionado|climatiza|carpete|celebraç|arquitetura/);
    expect(JSON.stringify(automotiveAgain)).not.toContain("Clima Dois");
    expect(automotive.commercialConfig?.serviceOfferings).toHaveLength(3);
  });

  it.each([
    ["aparelho funciona e gela, cheiro ruim, sem limpeza há muito tempo", "Higienização preventiva"],
    ["aparelho novo, ainda na caixa, nunca instalado e preciso colocar para funcionar", "Instalação de ar-condicionado"],
    ["aparelho liga, mas refrigera menos que antes", "Avaliação de baixo rendimento/refrigeração"],
  ])("usa evidência forte na ArViva: %s", (answer, expected) => {
    const project = projectFrom({ name: "ArViva Climatização", description: arvivaDescription, phone: "5511987654321" });
    const result = recommendService({ situation: answer }, project.commercialConfig?.serviceOfferings || [], { journeyMode: "assisted_discovery" });
    expect(result.service?.name).toBe(expected);
    expect(result.confidence).toBe("clear");
    expect(result.reason).toContain(answer);
  });

  it("preserva fallback para evidência ambígua", () => {
    const climate = projectFrom({ name: "ArViva Climatização", description: arvivaDescription });
    const bike = projectFrom({ name: "Pedal Livre Bike Shop", description: bikeDescription });
    expect(recommendService({ situation: "Meu ar não está funcionando direito." }, climate.commercialConfig?.serviceOfferings || []).confidence).toBe("uncertain");
    expect(recommendService({ situation: "Minha bicicleta está estranha." }, bike.commercialConfig?.serviceOfferings || []).confidence).toBe("uncertain");
  });

  it.each([
    ["Comprei uma bicicleta desmontada pela internet e preciso montar.", "Montagem de bicicleta nova"],
    ["Marchas pulam e tenho dificuldade para trocar.", "Ajuste de câmbio"],
  ])("generaliza strong evidence para Pedal Livre: %s", (answer, expected) => {
    const project = projectFrom({ name: "Pedal Livre Bike Shop", description: bikeDescription });
    const result = recommendService({ situation: answer }, project.commercialConfig?.serviceOfferings || []);
    expect(result).toMatchObject({ confidence: "clear", service: { name: expected } });
  });

  it("prioriza discovery declarado e mantém contato como conclusão", () => {
    const input = {
      businessName: "Pedal Livre Bike Shop",
      businessDescription: bikeDescription,
      primaryGoal: "Criar presença",
      primaryDestination: "WhatsApp",
      slug: "pedal-livre",
    };
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const actions = defaultVisitorActions(profile, bikeDescription);
    expect(actions[0]).toMatchObject({ key: "recommendation", isPrimary: true });
    expect(actions.some((action) => action.key === "contact" && !action.isPrimary)).toBe(true);
  });

  it("reaproveita e apresenta para confirmação as ofertas explícitas do contexto inicial", () => {
    const session = { initialInput: { businessName: "Pedal Livre Bike Shop", description: bikeDescription }, visitorActions: [recommendationAction], answers: {} };
    const suggestions = buildQualificationSuggestions(session);
    expect(suggestions["qualification.offerings"]?.split("\n")).toEqual([
      "Revisão completa", "Ajuste de freios", "Ajuste de câmbio", "Troca de pneus/câmaras", "Montagem de bicicleta nova",
    ]);
    expect(projectFrom({ name: "Pedal Livre Bike Shop", description: bikeDescription }).commercialConfig?.serviceOfferings).toHaveLength(5);
  });

  it("planeja perguntas do domínio que diferenciam as ofertas", () => {
    const climate = buildQualificationQuestionPlan({ initialInput: { businessName: "ArViva Climatização", description: arvivaDescription }, visitorActions: [recommendationAction], answers: {} });
    const bike = buildQualificationQuestionPlan({ initialInput: { businessName: "Pedal Livre Bike Shop", description: bikeDescription }, visitorActions: [recommendationAction], answers: {} });
    expect(climate[0].question).toContain("aparelho de ar-condicionado");
    expect(climate[1]).toMatchObject({ type: "radio", purpose: "signal" });
    expect(climate[1].options).toEqual(expect.arrayContaining([expect.stringMatching(/instalado|funcionamento/i), expect.stringMatching(/refrigera|rendimento/i)]));
    expect(bike[0].question).toContain("bicicleta");
    expect(bike[1].options).toEqual(expect.arrayContaining([expect.stringMatching(/marcha|câmbio/i), expect.stringMatching(/montar|desmontado/i)]));
    expect(bike).not.toEqual(climate);
  });

  it("não inventa Revenda e readiness bloqueia uma capability comercial sem evidência", () => {
    const project = projectFrom({ name: "ArViva Climatização", description: arvivaDescription, phone: "5511987654321" });
    expect(suggestSiteStructure(project).pages.some((page) => /revenda/i.test(`${page.name} ${page.pathSuggestion}`))).toBe(false);
    const invented = structuredClone(project);
    invented.steps[0].options = [{ id: "resale", label: "Revenda", value: "resale", actionType: "go_to_step", targetStepId: invented.steps[1].id }];
    expect(unsupportedCapabilityReferences(invented)).toEqual(expect.arrayContaining([expect.objectContaining({ key: "resale" })]));
    expect(getProjectReadiness(invented).blocking.some((issue) => issue.key.includes("capability.provenance.resale"))).toBe(true);
  });

  it("transporta contexto natural no fallback do WhatsApp", () => {
    const handoff = buildRecommendationHandoff({
      answers: { qualification_1: "Meu ar não está funcionando direito", qualification_2: "Quero entender o que precisa ser avaliado" },
      fields: [
        { id: "one", key: "qualification_1", label: "O que está acontecendo com o aparelho?", type: "textarea", required: true },
        { id: "two", key: "qualification_2", label: "O que você espera resolver?", type: "textarea", required: true },
      ],
      confidence: "uncertain",
    });
    expect(handoff.answers.contexto_informado).toContain("Meu ar não está funcionando direito");
    expect(handoff.answers.resultado_da_orientação).toMatch(/avaliação da equipe/i);
    expect(Object.keys(handoff.answers).join(" ")).not.toMatch(/orientacao_recebida/);
  });

  it("mantém as microdescrições conservadoras e readiness exige proveniência atual", () => {
    const project = projectFrom({ name: "ArViva Climatização", description: arvivaDescription, phone: "5511987654321" });
    const copy = (project.commercialConfig?.serviceOfferings || []).map((offer) => offer.shortDescription).join(" ");
    expect(copy).toContain("Serviço de instalação de ar-condicionado.");
    expect(copy).not.toMatch(/bancos|carpetes|celebrações|garantido|em \d+ horas/i);
    expect(validateConversionPath(project).checks.find((check) => check.key === "context")?.valid).toBe(true);
    const stale = structuredClone(project);
    const first = stale.commercialConfig?.serviceOfferings?.[0];
    if (first) first.settings = { ...first.settings, copyProvenance: { projectId: "outro-projeto" } };
    expect(validateConversionPath(stale).checks.find((check) => check.key === "context")?.valid).toBe(false);
  });

  it("aplica proteção responsiva genérica aos dois heróis", () => {
    const presence = readFileSync("src/components/public-presence/presence-section-renderer.tsx", "utf8");
    const journey = readFileSync("src/components/public-experience/public-experience.tsx", "utf8");
    for (const source of [presence, journey]) {
      expect(source).toContain("[overflow-wrap:anywhere]");
      expect(source).toContain("min-w-0");
    }
    expect(presence).toContain("text-[clamp(");
    expect(journey).toContain("overflow-x-clip");
  });
});
