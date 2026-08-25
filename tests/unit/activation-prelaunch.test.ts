import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { evaluateActivationPreflight } from "@/features/ai-setup/activation-preflight";
import { buildQualificationQuestionPlan, buildQualificationSuggestions } from "@/features/ai-setup/qualification-proposal";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { calculateSetupReadiness } from "@/features/ai-setup/setup-readiness";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";
import { defaultVisitorActions } from "@/features/ai-setup/visitor-actions";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import type { BusinessCapabilityProfile, DataRequirement } from "@/types";

const enabled = { enabled: true };
const preflightFeatures = {
  projects: { enabled: true, limit: 1, used: 0 },
  presence: enabled,
  presence_pages: { enabled: true, limit: 1, used: 0 },
  ai_business_analysis: enabled,
  ai_journey: enabled,
  ai_presence: enabled,
  ai_generations_month: { enabled: true, limit: 10, used: 0 },
};

function profile(description: string): BusinessCapabilityProfile {
  return new RuleBasedBusinessAnalyzer().analyze({
    businessName: "Negócio de teste",
    businessDescription: description,
    primaryGoal: description,
    primaryDestination: "Formulário",
    slug: "negocio-teste",
  });
}

describe("preflight da Activation", () => {
  it("libera trial elegível para criar, gerar e publicar", () => {
    const result = evaluateActivationPreflight({
      plan: { key: "trial", name: "Período de teste", status: "active" },
      features: preflightFeatures,
      projects: [],
    });

    expect(result.allowed).toBe(true);
    expect(result.checks).toEqual({
      canCreateProject: true,
      canGenerateInitialVersion: true,
      canPublish: true,
    });
  });

  it("bloqueia antes do onboarding quando o negócio do plano já foi usado", () => {
    const result = evaluateActivationPreflight({
      plan: { key: "pro", name: "SOBE Pro", status: "active" },
      features: { ...preflightFeatures, projects: { enabled: true, limit: 1, used: 1 } },
      projects: [{ id: "project-1", name: "Negócio existente", status: "draft" }],
    });

    expect(result.allowed).toBe(false);
    expect(result.checks.canCreateProject).toBe(false);
    expect(result.blockedReason).toContain("já está usando o negócio incluído");
    expect(result.actionPath).toBe("/app/projects/project-1");
  });
});

describe("WhatsApp da Activation", () => {
  it("normaliza um valor válido e mantém o inválido disponível para correção", () => {
    const valid = validateSetupPhone("5511000000000");
    const rawInvalid = "123";
    const invalid = validateSetupPhone(rawInvalid);

    expect(valid).toMatchObject({ valid: true, normalized: "+5511000000000" });
    expect(invalid).toMatchObject({ valid: false, error: "Confira o número. Use DDD + telefone." });
    expect(rawInvalid).toBe("123");
  });
});

describe("objetivo declarado e jornada proposta", () => {
  it.each([
    ["Clínica de estética. Quero ajudar o visitante a entender qual caminho faz sentido e solicitar uma avaliação.", "recommendation"],
    ["Marcenaria sob medida. Quero que o visitante solicite um orçamento para o projeto.", "quote"],
    ["Restaurante com delivery. Quero que o visitante faça um pedido pelo WhatsApp.", "order"],
  ] as const)("prioriza semanticamente o objetivo em negócios diferentes", (description, expected) => {
    const actions = defaultVisitorActions(profile(description), description);
    expect(actions.find((action) => action.isPrimary)?.key).toBe(expected);
    if (expected === "recommendation")
      expect(actions.map((action) => action.key)).not.toEqual(expect.arrayContaining(["quote", "schedule"]));
  });

  it("propõe qualificação e encaminhamento seguros sem pedir que o empresário desenhe o funil", () => {
    const description = "Clínica de estética com tratamentos faciais. Quero ajudar a pessoa a entender qual caminho faz sentido e solicitar uma avaliação.";
    const analyzed = profile(description);
    const actions = defaultVisitorActions(analyzed, description);
    const initialInput = { businessName: "Clínica Lumina", description, phone: "+5511999999999" };
    const suggestions = buildQualificationSuggestions({ initialInput, extractedProfile: analyzed, visitorActions: actions });
    const questionPlan = buildQualificationQuestionPlan({ initialInput, extractedProfile: analyzed, visitorActions: actions });
    const base = new RuleBasedExperienceComposer().compose({
      businessName: initialInput.businessName,
      businessDescription: description,
      primaryGoal: actions[0].label,
      primaryDestination: "WhatsApp",
      slug: "clinica-lumina",
      phone: initialInput.phone,
    });
    const requirements = draftCapabilityRequirements(base.capabilities || []);
    const answers: Record<string, unknown> = { ...suggestions, "qualification.questions": questionPlan };
    const session: AISetupSession = {
      id: "lumina-session",
      workspaceId: "workspace",
      status: "review",
      initialInput,
      extractedProfile: analyzed,
      visitorActions: actions,
      actionsConfirmed: true,
      answers,
      missingRequirements: requirements.map((requirement) => ({ ...requirement, status: "verified", value: answers[requirement.key], origin: "user" })),
      questions: [],
      sources: [],
      usedFallback: true,
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    const project = materializeSetupAnswers(base, session);
    const qualification = project.steps.find((step) => step.type === "form");
    const conclusion = project.steps.find((step) => step.type === "action");

    expect(questionPlan).toHaveLength(3);
    expect(suggestions["qualification.outcome"]).toContain("sem diagnosticar ou indicar um procedimento");
    expect(qualification?.formFields).toHaveLength(3);
    expect(conclusion?.description).toContain("avaliação profissional");
  });

  it("só libera o CTA final depois das confirmações obrigatórias", () => {
    const blocking: DataRequirement[] = [{
      id: "required",
      key: "qualification.questions",
      label: "Perguntas",
      capability: "qualification",
      status: "missing",
      severity: "blocking",
      reason: "Confirme as perguntas.",
    }];
    const session = {
      initialInput: { businessName: "Aurora", description: "Atendimento profissional personalizado." },
      actionsConfirmed: true,
      extractedProfile: profile("Atendimento profissional personalizado."),
    };

    expect(calculateSetupReadiness(blocking, session).readyToGenerate).toBe(false);
    expect(calculateSetupReadiness([{ ...blocking[0], status: "verified" }], session).readyToGenerate).toBe(true);
  });

  it("mantém guardrails de saúde nos prompts que geram a primeira experiência", () => {
    for (const file of [
      "business-analysis.ts",
      "journey-composition.ts",
      "site-composition.ts",
      "presence-composition.ts",
    ]) {
      const source = readFileSync(`src/server/ai/prompts/${file}`, "utf8");
      expect(source).toMatch(/nunca (?:diagnostique|produza diagnóstico)/i);
      expect(source).toMatch(/avaliação profissional/i);
    }
  });
});
