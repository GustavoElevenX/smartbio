import { describe, expect, it } from "vitest";

import { auditAnswerContextCoverage } from "@/features/ai-setup/answer-context-coverage";
import { setupInitialInputSchema, type AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { buildSetupAnswerContext, deterministicAnswerInterpretation } from "@/features/ai-setup/setup-answer-interpretation";
import type { SuggestedSiteStructure } from "@/features/site-composer/site-composer.types";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import type { AISetupActor } from "@/server/auth/setup-actor";

const rawAnswer = "Não temos site, use o cardápio https://menu.example.com; Unidade Golden Shop: (98) 99999-0001.";

function answerContext() {
  return buildSetupAnswerContext({
    sessionId: "session",
    answerKey: "business.extra_context",
    question: "Há mais alguma informação importante?",
    rawAnswer,
    interpretation: deterministicAnswerInterpretation(rawAnswer),
    interpretationMode: "deterministic_fallback",
    capturedAt: "2026-09-09T12:00:00.000Z",
  });
}

function suggestion(content: Record<string, unknown>): SuggestedSiteStructure {
  return {
    reasoning: "Estrutura contextual",
    pages: [{
      type: "home",
      name: "Início",
      purpose: "Apresentar o negócio",
      pathSuggestion: "/",
      sections: [{ sectionType: "hero", purpose: "Abertura", suggestedContent: content, sourceBindings: [], priority: "essential", reasoning: "Contexto confirmado" }],
    }],
    primaryConversionGoals: [],
    catalogStrategy: "inline_all",
    contentStrategy: [],
    visualDirection: [],
    warnings: [],
  };
}

describe("contexto integral das respostas da criação guiada", () => {
  it("preserva a resposta completa e registra fatos com origem e evidência", () => {
    const context = answerContext();
    expect(context.rawAnswer).toBe(rawAnswer);
    expect(context.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "url", value: "https://menu.example.com", origin: "user", sourceId: context.sourceId, verificationStatus: "verified" }),
      expect.objectContaining({ kind: "phone", value: "(98) 99999-0001", origin: "user", sourceId: context.sourceId }),
      expect.objectContaining({ kind: "other", label: "Resposta completa", value: rawAnswer }),
    ]));
  });

  it("aceita explicação com URL no campo de referência inicial", () => {
    expect(setupInitialInputSchema.safeParse({ businessName: "CSM", description: "Uma empresa com várias unidades comerciais.", websiteUrl: rawAnswer }).success).toBe(true);
  });

  it("liga a origem à seção quando o conteúdo aparece e sinaliza quando não aparece", () => {
    const context = answerContext();
    const represented = auditAnswerContextCoverage(suggestion({ title: "Veja nosso cardápio", url: "https://menu.example.com" }), [context], "2026-09-09T12:00:00.000Z");
    expect(represented.audit.status).toBe("complete");
    expect(represented.suggestion.pages[0].sections[0].sourceBindings).toContain(context.sourceId);

    const missing = auditAnswerContextCoverage(suggestion({ title: "Bem-vindo" }), [context], "2026-09-09T12:00:00.000Z");
    expect(missing.audit.status).toBe("needs_review");
    expect(missing.audit.unrepresented[0].sourceId).toBe(context.sourceId);
    expect(missing.suggestion.warnings[0]).toContain("precisam de revisão");
  });

  it("interpreta e persiste uma resposta livre mesmo fora da arquitetura comercial", async () => {
    const session: AISetupSession = {
      id: "session",
      workspaceId: "workspace",
      status: "waiting_answers",
      initialInput: { businessName: "CSM", description: "Uma empresa com várias unidades comerciais." },
      visitorActions: [],
      actionsConfirmed: true,
      answers: {},
      missingRequirements: [{ id: "extra", key: "business.extra_context", label: "Mais informações", capability: "project", status: "missing", severity: "warning", reason: "Completar o contexto" }],
      questions: [],
      sources: [],
      usedFallback: false,
      createdAt: "2026-09-09T12:00:00.000Z",
      updatedAt: "2026-09-09T12:00:00.000Z",
    };
    let stored = structuredClone(session);
    const repository = {
      async get() { return structuredClone(stored); },
      async update(_actor: AISetupActor, next: AISetupSession) { stored = structuredClone(next); return structuredClone(stored); },
      async addMessage() {},
    } as unknown as AISetupRepository;
    const actor: AISetupActor = { userId: "owner", email: "owner@sobe.test", workspaceId: "workspace", role: "owner", persistence: "memory", mode: "workspace" };
    const updated = await new AISetupService(repository).answer(actor, session.id, "business.extra_context", rawAnswer);
    expect(updated.answerContexts).toHaveLength(1);
    expect(updated.answerContexts?.[0]).toMatchObject({ answerKey: "business.extra_context", rawAnswer, origin: "user", interpretationMode: "deterministic_fallback" });
  });
});
