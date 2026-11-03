import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { buildSetupAnswerContext, deterministicAnswerInterpretation } from "@/features/ai-setup/setup-answer-interpretation";
import type { AISetupActor } from "@/server/auth/setup-actor";

const database = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: () => ({ insert: database.insert }),
  }),
}));

const { AISetupRepository } = await import("@/server/ai-setup/ai-setup-repository");

const actor: AISetupActor = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "owner@sobe.test",
  workspaceId: "20000000-0000-4000-8000-000000000001",
  role: "owner",
  persistence: "database",
  mode: "workspace",
};

function session(): AISetupSession {
  const rawAnswer = "Atendemos pelo WhatsApp (11) 99999-0001.";
  return {
    id: "30000000-0000-4000-8000-000000000001",
    workspaceId: actor.workspaceId,
    status: "collecting",
    initialInput: { businessName: "Studio Nexo", description: "Atendimento personalizado para empresas." },
    visitorActions: [],
    actionsConfirmed: false,
    answers: { objective: "Receber contatos" },
    answerContexts: [buildSetupAnswerContext({
      sessionId: "30000000-0000-4000-8000-000000000001",
      answerKey: "business.context",
      question: "Como funciona o atendimento?",
      rawAnswer,
      interpretation: deterministicAnswerInterpretation(rawAnswer),
      interpretationMode: "deterministic_fallback",
      capturedAt: "2026-09-24T12:00:00.000Z",
    })],
    missingRequirements: [],
    questions: [],
    sources: [],
    usedFallback: false,
    createdAt: "2026-09-24T12:00:00.000Z",
    updatedAt: "2026-09-24T12:00:00.000Z",
  };
}

describe("compatibilidade da persistência do onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.insert.mockImplementation((row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => database.insert.mock.calls.length === 1
          ? { data: null, error: { code: "PGRST204", message: "Could not find the 'answer_contexts' column in the schema cache" } }
          : {
              data: {
                ...row,
                created_at: "2026-09-24T12:00:00.000Z",
                updated_at: "2026-09-24T12:00:00.000Z",
              },
              error: null,
            },
      }),
    }));
  });

  it("reinicia a sessão mesmo antes da migração e preserva o contexto integral", async () => {
    const created = await new AISetupRepository().create(actor, session());
    const fallbackRow = database.insert.mock.calls[1][0] as Record<string, unknown>;
    const persistedAnswers = fallbackRow.answers as Record<string, unknown>;

    expect(database.insert).toHaveBeenCalledTimes(2);
    expect(fallbackRow).not.toHaveProperty("answer_contexts");
    expect(persistedAnswers).toHaveProperty("__sobe_answer_contexts");
    expect(created.answers).toEqual({ objective: "Receber contatos" });
    expect(created.answerContexts?.[0].rawAnswer).toContain("WhatsApp");
  });
});
