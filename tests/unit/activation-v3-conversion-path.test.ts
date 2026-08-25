import { describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { applyVisitorActionsToProject, ensureVisitorActionTargets, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { recommendSections } from "@/features/site-composer/section-recommendation";
import { inferBusinessShape } from "@/features/site-composer/business-shape";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { recommendService } from "@/features/qualification/recommendation-engine";
import type { Project } from "@/types";

const recommendationAction: VisitorActionSelection = {
  key: "recommendation",
  label: "Encontrar a opção ideal",
  isPrimary: true,
};

function recommendationProject(input: {
  name: string;
  description: string;
  offerings: string;
  phone?: string;
}) {
  const base = new RuleBasedExperienceComposer().compose({
    businessName: input.name,
    businessDescription: input.description,
    primaryGoal: recommendationAction.label,
    primaryDestination: input.phone ? "WhatsApp" : "Formulário",
    slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    phone: input.phone,
  });
  const qualificationStep = base.steps.find((step) => step.type === "form");
  const actionStep = base.steps.find((step) => step.type === "action");
  const choiceStep = base.steps.find((step) => step.type === "choice");
  const scopedBase: Project = {
    ...base,
    capabilities: base.capabilities?.filter((capability) => capability.key === "qualification"),
    commercialConfig: { qualificationRules: [] },
    dataRequirements: [],
    steps: base.steps.filter((step) => ["welcome", "choice"].includes(step.type) || step.id === qualificationStep?.id || step.id === actionStep?.id).map((step) => step.id === choiceStep?.id
      ? { ...step, options: step.options?.filter((option) => option.value === "qualification") }
      : step),
  };
  const answers = {
    "qualification.objective": "Ajudar a pessoa a encontrar a opção mais adequada antes de conversar com a equipe.",
    "qualification.offerings": input.offerings,
    "qualification.questions": "Qual resultado você busca?\nQuanto apoio você procura?\nQuando pretende começar?",
    "qualification.outcome": "Apresentar uma opção compatível e marcar uma conversa com a equipe.",
    "qualification.destination": input.phone ? "WhatsApp" : "Formulário",
  };
  const session: AISetupSession = {
    id: "activation-v3",
    workspaceId: "local-workspace",
    status: "review",
    initialInput: { businessName: input.name, description: input.description, phone: input.phone },
    visitorActions: [recommendationAction],
    actionsConfirmed: true,
    answers,
    missingRequirements: [],
    questions: [],
    sources: [],
    usedFallback: true,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
  let project = materializeSetupAnswers(scopedBase, session);
  project = ensureVisitorActionTargets(project, [recommendationAction]);
  project = applyVisitorActionsToProject(project, { visitorActions: [recommendationAction] });
  return project;
}

describe("Activation V3 — experiência gerada até a próxima ação", () => {
  it.each([
    {
      name: "Studio Nexo Interiores",
      description: "Escritório de interiores. O visitante deve descobrir qual serviço faz sentido e depois solicitar uma avaliação inicial.",
      offerings: "Consultoria de interiores; Projeto de um ambiente; Projeto completo de apartamento ou casa; Projeto para espaços comerciais; Acompanhamento de execução",
      choice: "Projeto de um ambiente",
      signal: "Quero renovar um ambiente da casa e preciso de orientação para esse espaço.",
      expectedCta: "Solicitar avaliação inicial",
    },
    {
      name: "Fluency Way",
      description: "Escola de idiomas. A pessoa deve descobrir qual modalidade faz sentido e depois marcar uma conversa.",
      offerings: "Inglês para iniciantes; Conversação; Inglês para viagens; Inglês para negócios; Preparação para entrevistas",
      choice: "Inglês para negócios",
      signal: "Preciso usar inglês no trabalho, em reuniões e apresentações para empresas.",
      expectedCta: "Marcar uma conversa",
    },
  ])("materializa perguntas, oferta real, explicação e WhatsApp para $name", ({ name, description, offerings, choice, signal, expectedCta }) => {
    const project = recommendationProject({ name, description, offerings, phone: "5511987654321" });
    const form = project.steps.find((step) => step.type === "form");
    const result = project.steps.find((step) => step.type === "recommendation");
    const action = project.steps.find((step) => step.type === "action");
    const recommendation = recommendService(
      { qualification_1: signal },
      project.commercialConfig?.serviceOfferings || [],
      { journeyMode: "assisted_discovery" },
    );

    expect(form?.formFields?.[0]).toMatchObject({ type: "textarea", purpose: "need" });
    expect(form?.formFields?.some((field) => field.options?.includes(choice))).toBe(false);
    expect(form?.options?.[0].targetStepId).toBe(result?.id);
    expect(recommendation.service?.name).toBe(choice);
    expect(recommendation.reason).toContain(signal.replace(/[.!?]+$/g, ""));
    expect(result?.options?.[0].targetStepId).toBe(action?.id);
    expect(action?.options?.[0]).toMatchObject({ actionType: "open_whatsapp", actionPayload: { phone: "5511987654321" } });
    expect(action?.options?.[0].label).toBe(expectedCta);
    expect(validateConversionPath(project)).toMatchObject({ kind: "recommendation", complete: true });
    expect(getProjectReadiness(project).blocking).toEqual([]);
  });

  it("não força recomendação quando o objetivo é apenas falar com a equipe", () => {
    const project = new RuleBasedExperienceComposer().compose({
      businessName: "Equipe Horizonte",
      businessDescription: "Atendimento direto para quem quer conversar com a equipe.",
      primaryGoal: "Falar com a equipe",
      primaryDestination: "Formulário",
      slug: "equipe-horizonte",
    });
    const direct: Project = {
      ...project,
      capabilities: [],
      dataRequirements: [],
      steps: [{
        id: "contact",
        type: "action",
        title: "Vamos conversar?",
        order: 0,
        isActive: true,
        options: [{ id: "send", label: "Enviar", value: "send", actionType: "submit_form" }],
      }],
    };
    expect(validateConversionPath(direct)).toMatchObject({ kind: "direct", complete: true });
    expect(direct.steps.some((step) => step.type === "recommendation")).toBe(false);
  });

  it("bloqueia uma orientação sem próxima ação e libera quando o destino volta", () => {
    const complete = recommendationProject({
      name: "Ateliê Caminhos",
      description: "Ajuda o visitante a escolher a opção adequada.",
      offerings: "Plano guiado; Acompanhamento integral",
      phone: "5511987654321",
    });
    const incomplete = structuredClone(complete);
    const action = incomplete.steps.find((step) => step.type === "action");
    if (action) action.options = [];

    expect(validateConversionPath(incomplete).checks.find((check) => check.key === "destination")?.valid).toBe(false);
    expect(getProjectReadiness(incomplete).publishable).toBe(false);
    expect(getProjectReadiness(complete).blocking).toEqual([]);
  });

  it("sintetiza o hero e mantém linguagem interna fora da copy pública", () => {
    const raw = "Uma descrição longa de onboarding que explica processos internos, operação, público, intenção, detalhes de atendimento e tudo o que o sistema precisa conhecer antes de gerar a página.";
    const project = recommendationProject({
      name: "Casa Norte",
      description: raw,
      offerings: "Orientação inicial; Plano personalizado",
      phone: "5511987654321",
    });
    const sections = recommendSections(inferBusinessShape(project));
    const visitorCopy = [
      project.description,
      ...project.steps.flatMap((step) => [step.title, step.description, step.recommendation?.title, step.recommendation?.description]),
      ...sections.flatMap((section) => [section.suggestedContent]),
    ].filter(Boolean).join(" ");

    expect(project.description).not.toBe(raw);
    expect(project.description.length).toBeLessThan(raw.length);
    expect(visitorCopy).not.toMatch(/handoff|qualifica(?:ção|cao)|ader[eê]ncia|conversion|funnel/i);
  });
});
