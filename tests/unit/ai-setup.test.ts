import { describe, expect, it } from "vitest";
import { calculateSetupReadiness } from "@/server/ai-setup/readiness";
import { planAdaptiveQuestions } from "@/server/ai-setup/question-planner";
import { stageGeneratedDraft } from "@/features/ai-setup/stage-generated-draft";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { aiSetupSessionSchema, setupInitialInputSchema } from "@/features/ai-setup/ai-setup.schema";
import {
  applyVisitorActionsToProject,
  defaultVisitorActions,
  profileWithVisitorActions,
  stepSupportsVisitorAction,
} from "@/features/ai-setup/visitor-actions";
import { casaDeSucos } from "@/data/demo-projects";
import { capabilityPlanner } from "@/features/capabilities/capability-planner";
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
    expect(result.conversionGoals?.every((goal) => {
      const action = actions.find((item) => `${project.id}-goal-${item.key}` === goal.id);
      const step = result.steps.find((item) => item.id === goal.targetStepId);
      return Boolean(action && step && stepSupportsVisitorAction(result, step, action.key));
    })).toBe(true);
  });

  it("faz ações confirmadas substituírem intenções comerciais inferidas", () => {
    const inferred = structuredClone(casaDeSucos.businessProfile!);
    inferred.primaryIntents = ["buy", "contact"];
    inferred.secondaryIntents = ["schedule"];

    const result = profileWithVisitorActions(inferred, [
      { key: "quote", label: "Pedir orçamento", isPrimary: true },
      { key: "find_location", label: "Encontrar uma unidade", isPrimary: false },
    ]);

    expect(result.primaryIntents).toEqual(["request_quote"]);
    expect(result.secondaryIntents).toEqual(["visit"]);
    expect([...result.primaryIntents, ...result.secondaryIntents]).not.toEqual(
      expect.arrayContaining(["buy", "contact", "schedule"]),
    );
    expect(result.offerKinds).toEqual(inferred.offerKinds);
  });

  it("planeja no onboarding somente capacidades das ações confirmadas", () => {
    const profile = structuredClone(casaDeSucos.businessProfile!);
    const capabilities = capabilityPlanner.planForVisitorActions(profile, [
      { key: "quote", label: "Pedir orçamento", isPrimary: true },
    ]);

    expect(capabilities.map((capability) => capability.key)).toEqual(["quote"]);
  });

  it("nunca aponta localização para a primeira etapa arbitrária", () => {
    const project = structuredClone(casaDeSucos);
    project.steps = [{
      id: "catalog-first",
      type: "catalog",
      title: "Catálogo",
      order: 0,
      isActive: true,
      options: [{
        id: "catalog-action",
        label: "Continuar",
        value: "catalog",
        actionType: "start_capability",
        actionPayload: { capability: "catalog_order" },
      }],
    }];

    const result = applyVisitorActionsToProject(project, {
      visitorActions: [{ key: "find_location", label: "Encontrar uma unidade", isPrimary: true }],
    });
    const goal = result.conversionGoals?.[0];
    const target = result.steps.find((step) => step.id === goal?.targetStepId);

    expect(goal?.targetStepId).not.toBe("catalog-first");
    expect(target?.type).toBe("routing");
    expect(target && stepSupportsVisitorAction(result, target, "find_location")).toBe(true);
  });

  it("resolve targets e destinos coerentes para ações comerciais diferentes", () => {
    const project = structuredClone(casaDeSucos);
    const result = applyVisitorActionsToProject(project, {
      visitorActions: [
        { key: "order", label: "Fazer um pedido", isPrimary: true },
        { key: "quote", label: "Pedir orçamento", isPrimary: false },
        { key: "find_location", label: "Encontrar uma unidade", isPrimary: false },
      ],
    });
    const goals = new Map(result.conversionGoals?.map((goal) => [goal.name, goal]));
    const order = goals.get("Fazer um pedido")!;
    const quote = goals.get("Pedir orçamento")!;
    const location = goals.get("Encontrar uma unidade")!;

    expect(new Set([order.targetStepId, quote.targetStepId, location.targetStepId])).toHaveLength(3);
    expect(order.destinationLabel).toBe("Pedido");
    expect(quote.destinationLabel).toBe("Orçamento");
    expect(location.destinationLabel).not.toBe(project.primaryDestination);
    expect(new Set([order.destinationLabel, quote.destinationLabel, location.destinationLabel]).size).toBe(3);
  });
});
