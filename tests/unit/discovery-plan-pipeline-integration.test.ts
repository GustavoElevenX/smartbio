import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import { ActivationGateFakeProvider } from "@/server/ai/activation-gate-fake-provider";
import { setAIProviderForTests } from "@/server/ai/ai-client";
import type { AISetupActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";
import { recommendService } from "@/features/qualification/recommendation-engine";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import type { DiscoveryPlanningInput } from "@/server/ai/ai-provider";

class FailingDiscoveryProvider extends ActivationGateFakeProvider {
  override async composeDiscoveryPlan(): Promise<never> { throw new Error("provider indisponível"); }
}

class IncompleteDiscoveryProvider extends ActivationGateFakeProvider {
  override async composeDiscoveryPlan(input: DiscoveryPlanningInput) {
    const draft = await super.composeDiscoveryPlan(input);
    return { ...draft, offerIntelligenceProfiles: draft.offerIntelligenceProfiles.slice(0, -1) };
  }
}

const actor: AISetupActor = { userId: "activation-user", email: "activation@sobe.test", workspaceId: "activation-workspace", role: "owner", persistence: "memory", mode: "workspace" };

function repositoryDouble() {
  const sessions = new Map<string, AISetupSession>();
  return {
    repository: {
      async create(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
      async createIdempotent(_actor: AISetupActor, session: AISetupSession) { sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
      async get(_actor: AISetupActor, id: string) { const value = sessions.get(id); return value ? structuredClone(value) : null; },
      async latestActive() { return null; },
      async update(_actor: AISetupActor, session: AISetupSession) { if (!sessions.has(session.id)) throw new AISetupNotFoundError("ausente"); sessions.set(session.id, structuredClone(session)); return structuredClone(session); },
      async addMessage() {},
    } as unknown as AISetupRepository,
  };
}

async function sessionWithPlan(provider: ActivationGateFakeProvider, offerNames: string[]) {
  setAIProviderForTests(provider);
  const { repository } = repositoryDouble();
  const service = new AISetupService(repository);
  let session = await service.start(actor, {
    businessName: "Casa Clara Persianas",
    description: "A Casa Clara vende persianas e ajuda o visitante a descobrir a opção mais adequada conforme luz, privacidade e acabamento, concluindo pelo WhatsApp.",
    phone: "5511987654321",
  });
  session = await service.analyze(actor, session.id);
  session = await service.confirmVisitorActions(actor, session.id, [
    { key: "recommendation", label: "Descobrir minha persiana", isPrimary: true },
    { key: "contact", label: "Conversar com a equipe", isPrimary: false },
  ]);
  session = await service.answer(actor, session.id, "qualification.objective", "Entender qual persiana combina com a necessidade do ambiente");
  session = await service.answer(actor, session.id, "qualification.offerings", offerNames);
  return { service, session };
}

async function generateDraft(service: AISetupService, initial: AISetupSession) {
  let session = initial;
  if (session.discoveryPlan) session = await service.answer(actor, session.id, "qualification.questions", session.discoveryPlan.questions);
  for (const requirement of session.missingRequirements.filter((item) => item.status !== "verified")) {
    const value = requirement.key === "qualification.destination" ? "WhatsApp" : requirement.key === "qualification.outcome" ? "Apresentar uma opção real com explicação conservadora" : "Confirmado pela equipe";
    session = await service.answer(actor, session.id, requirement.key, value);
  }
  return service.generate(actor, session.id);
}

beforeEach(() => {
  process.env.ACTIVATION_GATE_FAKE_AI = "true";
  setAIProviderForTests(new ActivationGateFakeProvider());
});

afterEach(() => {
  delete process.env.ACTIVATION_GATE_FAKE_AI;
  setAIProviderForTests(undefined);
});

describe("pipeline integration real do DiscoveryPlan", () => {
  it("injeta o provider antes do serviço e reutiliza o mesmo plano até o projeto materializado", async () => {
    const { repository } = repositoryDouble();
    const service = new AISetupService(repository);
    let session = await service.start(actor, {
      businessName: "Casa Clara Persianas",
      description: "A Casa Clara vende persianas e ajuda o visitante a descobrir a opção mais adequada conforme luz, privacidade e acabamento, concluindo pelo WhatsApp.",
      phone: "5511987654321",
    });
    session = await service.analyze(actor, session.id);
    session = await service.confirmVisitorActions(actor, session.id, [
      { key: "recommendation", label: "Descobrir minha persiana", isPrimary: true },
      { key: "contact", label: "Conversar com a equipe", isPrimary: false },
    ]);
    const ordered = session.missingRequirements.map((item) => item.key);
    expect(ordered.indexOf("qualification.offerings")).toBeLessThan(ordered.indexOf("qualification.questions"));
    expect(session.questions.some((item) => item.key === "qualification.questions")).toBe(false);
    expect(session.questions.map((item) => item.key)).toEqual(expect.arrayContaining(["qualification.objective", "qualification.offerings"]));

    session = await service.answer(actor, session.id, "qualification.objective", "Entender qual persiana combina com a necessidade do ambiente");
    expect(session.questions.map((item) => item.key)).toContain("qualification.offerings");
    session = await service.answer(actor, session.id, "qualification.offerings", ["Persiana Rolô Blackout", "Persiana Romana", "Persiana Double Vision"]);
    const firstPlan = session.discoveryPlan!;
    expect(firstPlan.status).toBe("ready");
    expect(session.questions.find((item) => item.key === "qualification.questions")?.structuredAnswer).toEqual(firstPlan.questions);

    session = await service.answer(actor, session.id, "qualification.objective", "Comparar controle de luz, privacidade e acabamento antes do contato");
    const persistedPlan = session.discoveryPlan!;
    expect(persistedPlan.id).not.toBe(firstPlan.id);
    expect(session.answers["qualification.questions"]).toBeUndefined();
    expect(session.missingRequirements.find((item) => item.key === "qualification.questions")?.status).toBe("missing");
    expect(session.questions.find((item) => item.key === "qualification.questions")?.structuredAnswer).toEqual(persistedPlan.questions);

    session = await service.answer(actor, session.id, "qualification.questions", persistedPlan.questions);
    expect(session.questions.length).toBeGreaterThan(0);
    for (const requirement of session.missingRequirements.filter((item) => item.status !== "verified")) {
      const value = requirement.key === "qualification.destination" ? "WhatsApp" : requirement.key === "qualification.outcome" ? "Apresentar uma opção real com explicação conservadora" : "Confirmado pela equipe";
      session = await service.answer(actor, session.id, requirement.key, value);
    }
    session = await service.generate(actor, session.id);
    const project = session.projectDraft as Project;
    expect(project.discoveryPlan?.id).toBe(persistedPlan.id);
    expect(project.discoveryPlan?.version).toBe(persistedPlan.version);
    expect(project.discoveryPlan?.projectId).toBe(project.id);
    expect(project.commercialConfig?.serviceOfferings?.map((item) => item.id)).toEqual(persistedPlan.offerings.map((item) => item.id));
    expect(project.commercialConfig?.serviceOfferings?.every((item) => item.settings?.discoveryPlanId === persistedPlan.id)).toBe(true);
    expect(validateConversionPath(project).checks.find((check) => check.key === "plan")?.valid).toBe(true);
    const runtime = recommendService({ qualification_1: "Quero bloquear a entrada de luz e ter mais privacidade no ambiente." }, project.commercialConfig?.serviceOfferings || []);
    expect(runtime.service?.name).toBe("Persiana Rolô Blackout");
    expect(runtime.strongEvidence).toBe(true);
  });

  it("mantém falha do provider explicitamente degradada e readiness bloqueada", async () => {
    const { service, session } = await sessionWithPlan(new FailingDiscoveryProvider(), ["Persiana Rolô Blackout", "Persiana Romana", "Persiana Double Vision"]);
    expect(session.discoveryPlan).toMatchObject({ status: "degraded", provenance: { source: "deterministic_placeholder" } });
    expect(session.usedFallback).toBe(true);
    const generated = await generateDraft(service, session);
    const project = generated.projectDraft as Project;
    expect(validateConversionPath(project).checks.find((check) => check.key === "plan")?.valid).toBe(false);
    expect(getProjectReadiness(project).publishable).toBe(false);
  });

  it("não promove resposta incompleta de 4/5 perfis e readiness continua bloqueada", async () => {
    const offers = ["Persiana Rolô Blackout", "Persiana Romana", "Persiana Double Vision", "Persiana Painel", "Persiana Vertical"];
    const { service, session } = await sessionWithPlan(new IncompleteDiscoveryProvider(), offers);
    expect(session.discoveryPlan?.status).toBe("degraded");
    expect(session.discoveryPlan?.issues.join(" ")).toContain("Persiana Vertical");
    const generated = await generateDraft(service, session);
    const project = generated.projectDraft as Project;
    expect(project.commercialConfig?.serviceOfferings).toHaveLength(5);
    expect(validateConversionPath(project).checks.find((check) => check.key === "plan")?.valid).toBe(false);
    expect(getProjectReadiness(project).publishable).toBe(false);
  });
});
