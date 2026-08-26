import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ActivationUnderstanding, AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import {
  actionsFromActivationUnderstanding,
  deterministicActivationUnderstanding,
  normalizeActivationUnderstanding,
} from "@/features/ai-setup/activation-understanding";
import { activationStateInvariantIssues } from "@/features/ai-setup/activation-state-invariants";
import { calculateSetupReadiness } from "@/features/ai-setup/setup-readiness";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import { ContractActivationProvider } from "@/server/ai/activation-gate-fake-provider";
import { setAIProviderForTests } from "@/server/ai/ai-client";
import type { AISetupActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";

const actor: AISetupActor = {
  userId: "sonoleve-user",
  email: "sonoleve@sobe.test",
  workspaceId: "sonoleve-workspace",
  role: "owner",
  persistence: "memory",
  mode: "workspace",
};

const offerNames = [
  "Colchão de espuma",
  "Colchão de molas ensacadas",
  "Colchão ortopédico",
  "Pillow top",
  "Protetor impermeável",
];

const sonoLeveDescription = `A SonoLeve é uma loja especializada em colchões e conforto para o sono. Muitos clientes sabem o que os incomoda, mas não sabem qual opção escolher.

Produtos reais:
- Colchão de espuma
- Colchão de molas ensacadas
- Colchão ortopédico
- Pillow top
- Protetor impermeável

Queremos que a pessoa explique o que busca, responda poucas perguntas e receba uma orientação entre essas opções antes de continuar pelo WhatsApp.`;

function repositoryDouble() {
  const sessions = new Map<string, AISetupSession>();
  return {
    async create(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async createIdempotent(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async get(_actor: AISetupActor, id: string) { const value = sessions.get(id); return value ? structuredClone(value) : null; },
    async latestActive() { return null; },
    async update(_actor: AISetupActor, session: AISetupSession) { if (!sessions.has(session.id)) throw new AISetupNotFoundError("ausente"); sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
    async addMessage() {},
  } as unknown as AISetupRepository;
}

function contextualUnderstanding(declaredObjective: string, offerings = offerNames): ActivationUnderstanding {
  return normalizeActivationUnderstanding({
    status: "ready",
    source: "contextual_ai",
    declaredObjective,
    primaryAction: {
      key: "recommendation",
      label: "Receber uma recomendação",
      confidence: 0.97,
      evidence: [declaredObjective],
      source: "contextual_ai",
    },
    secondaryActions: [{ key: "contact", label: "Falar com a equipe", confidence: 0.93, source: "contextual_ai" }],
    completionAction: { key: "contact", label: "Continuar pelo WhatsApp", destination: "whatsapp", confidence: 0.99, source: "contextual_ai" },
    offerings: offerings.map((name) => ({ name, kind: "product", evidence: name, confidence: 0.98, source: "contextual_ai" })),
    needsAssistedDiscovery: true,
    confidence: 0.97,
    issues: [],
  });
}

beforeEach(() => {
  process.env.ACTIVATION_GATE_FAKE_AI = "true";
  setAIProviderForTests(new ContractActivationProvider());
});
afterEach(() => {
  delete process.env.ACTIVATION_GATE_FAKE_AI;
  setAIProviderForTests(undefined);
});

describe("ACTION/UNDERSTANDING CONTRACT", () => {
  it.each([
    "receba orientação",
    "receberá uma orientação",
    "queremos orientar o cliente",
    "ajudamos a identificar a opção",
    "descobre qual alternativa combina",
    "entende qual plano faz sentido",
  ])("a ação vem do contrato contextual, independentemente da forma linguística: %s", (phrase) => {
    const actions = actionsFromActivationUnderstanding(contextualUnderstanding(phrase));
    expect(actions[0]).toMatchObject({ key: "recommendation", isPrimary: true, source: "contextual_ai" });
    expect(actions.find((action) => action.key === "contact")).toMatchObject({ isPrimary: false });
  });

  it("mantém o fallback determinístico explicitamente degradado", () => {
    const profile = new RuleBasedBusinessAnalyzer().analyze({
      businessName: "Fallback",
      businessDescription: "Atendimento geral pelo WhatsApp.",
      primaryGoal: "Atender",
      primaryDestination: "WhatsApp",
      slug: "fallback",
    });
    expect(deterministicActivationUnderstanding({ profile, businessDescription: "Atendimento geral pelo WhatsApp.", phone: "+5511999999999" })).toMatchObject({
      status: "degraded",
      source: "deterministic_fallback",
    });
  });
});

describe("CONTEXTUAL CATALOG CONTRACT", () => {
  it.each([
    ["Produtos reais", "product"],
    ["Serviços", "service"],
    ["Planos", "plan"],
    ["Modalidades", "other"],
    ["Trabalhamos com A, B e C", "package"],
  ] as const)("preserva ofertas e proveniência para %s", (_format, kind) => {
    const understanding = contextualUnderstanding("Ajudar a descobrir a opção adequada", ["Opção A", "Opção B", "Opção C"]);
    const typed = normalizeActivationUnderstanding({
      ...understanding,
      offerings: understanding.offerings.map((offering) => ({ ...offering, kind })),
    });
    expect(typed.offerings.map((offering) => offering.name)).toEqual(["Opção A", "Opção B", "Opção C"]);
    expect(typed.offerings.every((offering) => offering.source === "contextual_ai" && offering.evidence)).toBe(true);
  });
});

describe("SONOLEVE REGRESSION + STATE MACHINE INVARIANTS", () => {
  it("faz 5/5 ofertas virarem plano e perguntas sem intervenção estratégica", async () => {
    const service = new AISetupService(repositoryDouble());
    let session = await service.start(actor, {
      businessName: "SonoLeve Colchões",
      description: sonoLeveDescription,
      phone: "+5511999990000",
    });
    session = await service.analyze(actor, session.id);
    expect(session.visitorActions.find((action) => action.isPrimary)).toMatchObject({ key: "recommendation", source: "contextual_ai" });
    expect(session.activationUnderstanding?.offerings.map((offering) => offering.name)).toEqual(offerNames);

    session = await service.confirmVisitorActions(actor, session.id, session.visitorActions.map(({ key, label, isPrimary }) => ({ key, label, isPrimary })));
    expect(session.visitorActions.find((action) => action.isPrimary)).toMatchObject({ key: "recommendation", confirmedByBusiness: true, source: "contextual_ai" });
    expect(session.missingRequirements.some((item) => item.key === "qualification.questions")).toBe(false);
    expect(activationStateInvariantIssues(session)).toEqual([]);

    session = await service.answer(actor, session.id, "qualification.objective", session.activationUnderstanding!.declaredObjective);
    session = await service.answer(actor, session.id, "qualification.offerings", offerNames);
    expect(session.discoveryPlan).toMatchObject({ status: "ready" });
    expect(session.discoveryPlan?.offerings.map((offering) => offering.name)).toEqual(offerNames);
    expect(session.discoveryPlan?.questions.length).toBeGreaterThanOrEqual(2);
    expect(session.questions.find((question) => question.key === "qualification.questions")?.structuredAnswer).toEqual(session.discoveryPlan?.questions);
    expect(activationStateInvariantIssues(session)).toEqual([]);

    session = await service.answer(actor, session.id, "qualification.questions", session.discoveryPlan!.questions);
    for (let guard = 0; guard < 10; guard += 1) {
      const pending = session.missingRequirements.find((requirement) => requirement.severity === "blocking" && requirement.status !== "verified");
      if (!pending) break;
      const suggestion = session.questions.find((question) => question.key === pending.key)?.suggestedAnswer;
      session = await service.answer(actor, session.id, pending.key, suggestion || "Confirmado pela equipe");
    }
    expect(calculateSetupReadiness(session.missingRequirements, session).readyToGenerate).toBe(true);
    session = await service.generate(actor, session.id);
    const project = session.projectDraft as Project;
    expect(project.discoveryPlan?.offerings.map((offering) => offering.name)).toEqual(offerNames);
    expect(project.discoveryPlan?.questions.length).toBeGreaterThanOrEqual(2);
    expect(project.steps.some((step) => step.formFields?.length)).toBe(true);
  });

  it("detecta explicitamente o estado impossível original", () => {
    const impossible = {
      id: "impossible",
      workspaceId: "workspace",
      status: "waiting_answers",
      initialInput: { businessName: "SonoLeve", description: sonoLeveDescription },
      visitorActions: [{ key: "recommendation", label: "Receber uma recomendação", isPrimary: true }],
      actionsConfirmed: true,
      answers: {},
      missingRequirements: [{ id: "questions", key: "qualification.questions", label: "Perguntas", capability: "qualification", status: "missing", severity: "blocking", reason: "Confirme" }],
      questions: [],
      sources: [],
      usedFallback: false,
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z",
    } as AISetupSession;
    expect(activationStateInvariantIssues(impossible)).toContain("qualification.questions está bloqueante sem pergunta visível, resolução automática ou erro recuperável.");
  });
});
