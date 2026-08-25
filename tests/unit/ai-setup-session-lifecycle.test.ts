import { afterEach, describe, expect, it, vi } from "vitest";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import {
  parseRememberedAISetupSession,
} from "@/features/ai-setup/ai-setup-state";
import {
  hasConfirmedSetupPhone,
  hasRelevantSetupInformation,
} from "@/features/ai-setup/session-lifecycle";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import type { AISetupActor } from "@/server/auth/setup-actor";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";

const actor: AISetupActor = {
  userId: "local-user",
  email: "local@sobe.test",
  workspaceId: "local-workspace",
  role: "owner",
  persistence: "memory",
  mode: "workspace",
};

function repositoryDouble() {
  const sessions = new Map<string, AISetupSession>();
  return {
    sessions,
    repository: {
      async createIdempotent(_actor: AISetupActor, session: AISetupSession) {
        const existing = sessions.get(session.id);
        if (existing) return structuredClone(existing);
        sessions.set(session.id, structuredClone(session));
        return structuredClone(session);
      },
      async get(_actor: AISetupActor, id: string) {
        const session = sessions.get(id);
        return session ? structuredClone(session) : null;
      },
      async latestActive() {
        return [...sessions.values()][0] || null;
      },
      async update(_actor: AISetupActor, session: AISetupSession) {
        if (!sessions.has(session.id))
          throw new AISetupNotFoundError("Sessão de onboarding não encontrada.");
        sessions.set(session.id, structuredClone(session));
        return structuredClone(session);
      },
      async addMessage() {},
    } as unknown as AISetupRepository,
  };
}

function analyzedSession(phone?: string): AISetupSession {
  return {
    id: "session",
    workspaceId: actor.workspaceId,
    status: "waiting_answers",
    initialInput: {
      businessName: "Studio Nexo",
      description: "Escritório de arquitetura e interiores para reformas.",
      phone,
    },
    extractedProfile: new RuleBasedBusinessAnalyzer().analyze({
      businessName: "Studio Nexo",
      businessDescription: "Escritório de arquitetura e interiores para reformas.",
      primaryGoal: "Orientar o visitante",
      primaryDestination: "WhatsApp",
      slug: "studio-nexo",
      phone,
    }),
    visitorActions: [],
    actionsConfirmed: false,
    answers: {},
    missingRequirements: [],
    questions: [],
    sources: [],
    usedFallback: true,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

afterEach(() => vi.restoreAllMocks());

describe("ponteiro local da sessão de Activation", () => {
  it("aceita o ponteiro versionado somente no workspace correto", () => {
    const raw = JSON.stringify({
      version: 2,
      sessionId: "session-1",
      workspaceId: "workspace-1",
      draft: {
        businessName: "Studio Nexo",
        description: "Rascunho",
        websiteUrl: "",
        phone: "(11) 98765-4321",
      },
    });

    expect(parseRememberedAISetupSession(raw, "workspace-1")?.sessionId).toBe(
      "session-1",
    );
    expect(parseRememberedAISetupSession(raw, "workspace-2")).toBeNull();
  });

  it("migra o snapshot legado apenas como ponteiro e rascunho recuperável", () => {
    const parsed = parseRememberedAISetupSession(
      JSON.stringify({
        id: "legacy-session",
        workspaceId: "workspace-1",
        initialInput: {
          businessName: "Negócio antigo",
          description: "Descrição antiga",
          phone: "11987654321",
        },
      }),
      "workspace-1",
    );

    expect(parsed).toMatchObject({
      sessionId: "legacy-session",
      legacy: true,
      draft: { phone: "11987654321" },
    });
  });
});

describe("lifecycle no backend", () => {
  it("inicializa idempotentemente e só retorna depois de a sessão existir", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { repository, sessions } = repositoryDouble();
    const service = new AISetupService(repository);

    const first = await service.initialize(actor, "same-session", "new");
    const retry = await service.initialize(actor, "same-session", "new");

    expect(first.id).toBe("same-session");
    expect(retry.id).toBe(first.id);
    expect(sessions).toHaveLength(1);
    expect(await service.get(actor, first.id)).toMatchObject({
      status: "collecting",
      initialInput: { businessName: "", description: "" },
    });
  });

  it("distingue sessão ausente e preserva o rascunho inválido para correção", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { repository } = repositoryDouble();
    const service = new AISetupService(repository);

    await expect(service.get(actor, "missing")).rejects.toBeInstanceOf(
      AISetupNotFoundError,
    );
    const created = await service.initialize(actor, "draft-session", "new");
    const saved = await service.saveDraft(actor, created.id, {
      businessName: "Studio Nexo",
      description: "Rascunho ainda incompleto",
      phone: "123",
    });
    expect(saved.initialInput.phone).toBe("123");
  });
});

describe("confirmação persistida do WhatsApp", () => {
  it("só confirma número válido em sessão analisada e fora de edição", () => {
    expect(hasConfirmedSetupPhone(analyzedSession(), false)).toBe(false);
    expect(hasConfirmedSetupPhone(analyzedSession("123"), false)).toBe(false);
    expect(
      hasConfirmedSetupPhone(analyzedSession("+5511987654321"), false),
    ).toBe(true);
    expect(
      hasConfirmedSetupPhone(analyzedSession("+5511987654321"), true),
    ).toBe(false);
    expect(hasRelevantSetupInformation(analyzedSession())).toBe(true);
  });
});
