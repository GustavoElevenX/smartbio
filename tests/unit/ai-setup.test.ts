import { describe, expect, it } from "vitest";
import { calculateSetupReadiness } from "@/server/ai-setup/readiness";
import { planAdaptiveQuestions } from "@/server/ai-setup/question-planner";
import { stageGeneratedDraft } from "@/features/ai-setup/stage-generated-draft";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupSessionSchema, setupInitialInputSchema } from "@/features/ai-setup/ai-setup.schema";
import { applyVisitorActionsToProject, defaultVisitorActions } from "@/features/ai-setup/visitor-actions";
import { casaDeSucos } from "@/data/demo-projects";
import type { DataRequirement, Project } from "@/types";

const requirements: DataRequirement[] = [
  { id: "one", key: "quote.services", label: "Serviços do orçamento", capability: "quote", status: "missing", severity: "blocking", reason: "Quais serviços podem receber orçamento?" },
  { id: "two", key: "quote.mode", label: "Modo de orçamento", capability: "quote", status: "missing", severity: "blocking", reason: "Como o orçamento será calculado?" },
  { id: "three", key: "project.notes", label: "Observação", capability: "project", status: "missing", severity: "optional", reason: "Deseja adicionar uma observação?" },
];

describe("onboarding adaptativo", () => {
  it("prioriza requisitos bloqueadores, limita o lote e não repete respostas", () => {
    const first = planAdaptiveQuestions(requirements, {}, 2);
    expect(first).toHaveLength(2);
    expect(first.every((item) => item.required)).toBe(true);
    expect(first.map((item) => item.key)).toContain("quote.services");
    const next = planAdaptiveQuestions(requirements, { "quote.services": "Consultoria" }, 2);
    expect(next.map((item) => item.key)).not.toContain("quote.services");
  });

  it("expõe prontidão e pendências sem fingir que dados ausentes foram confirmados", () => {
    const readiness = calculateSetupReadiness(requirements, { initialInput: { businessName: "Aurora", description: "Consultoria financeira personalizada.", phone: "5511999999999" } });
    expect(readiness.readyToGenerate).toBe(true);
    expect(readiness.blocking).toBe(2);
    expect(readiness.progress).toBe(50);
  });

  it("mantém o projeto gerado apenas como rascunho até ele existir no banco", () => {
    const session: AISetupSession = {
      id: crypto.randomUUID(),
      workspaceId: crypto.randomUUID(),
      status: "generating",
      initialInput: { businessName: "Aurora", description: "Consultoria financeira personalizada." },
      visitorActions: [],
      actionsConfirmed: false,
      answers: {},
      missingRequirements: [],
      questions: [],
      sources: [],
      usedFallback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const projectDraft = { id: crypto.randomUUID() } as Project;

    const staged = stageGeneratedDraft(session, projectDraft, false);

    expect(staged.projectDraft).toBe(projectDraft);
    expect(staged.projectId).toBeUndefined();
    expect(staged.status).toBe("review");
  });

  it("aceita entradas novas e antigas sem obrigar a escolha de superfície", () => {
    expect(setupInitialInputSchema.parse({ businessName: "Aurora", description: "Consultoria financeira personalizada." }).requestedSurface).toBeUndefined();
    expect(setupInitialInputSchema.parse({ requestedSurface: "landing_page", businessName: "Aurora", description: "Consultoria financeira personalizada." }).requestedSurface).toBe("landing_page");
    const legacy = aiSetupSessionSchema.parse({
      id: "legacy", workspaceId: "workspace", status: "collecting",
      initialInput: { requestedSurface: "business_site", businessName: "Aurora", description: "Consultoria financeira personalizada." },
      answers: {}, missingRequirements: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    expect(legacy.visitorActions).toEqual([]);
    expect(legacy.actionsConfirmed).toBe(false);
  });

  it("transforma várias ações humanas em objetivos ligados a etapas reais", () => {
    const project = structuredClone(casaDeSucos);
    const actions = defaultVisitorActions(project.businessProfile!).slice(0, 3).map((action, index) => ({ ...action, isPrimary: index === 0 }));
    const result = applyVisitorActionsToProject(project, { visitorActions: actions });
    const stepIds = new Set(result.steps.filter((step) => step.isActive).map((step) => step.id));

    expect(result.conversionGoals).toHaveLength(actions.length);
    expect(result.conversionGoals?.filter((goal) => goal.isPrimary)).toHaveLength(1);
    expect(result.conversionGoals?.every((goal) => stepIds.has(goal.targetStepId))).toBe(true);
  });
});
