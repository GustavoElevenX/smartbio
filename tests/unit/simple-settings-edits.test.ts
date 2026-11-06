import { describe, expect, it } from "vitest";
import { findDemoProject } from "@/data/demo-projects";
import { validateSimpleProject, withDiscoveryQuestions } from "@/features/simple-settings/edits";

describe("edição simples das jornadas", () => {
  it("impede ativar uma intenção cuja etapa não existe", () => {
    const project = structuredClone(findDemoProject("demo-casa-sucos")!);
    const goal = project.conversionGoals?.[0];
    expect(goal).toBeDefined();
    project.conversionGoals = [{ ...goal!, targetStepId: "etapa-ausente", isActive: true }];
    expect(validateSimpleProject(project)).toMatch(/etapa/);
  });

  it("sincroniza perguntas do plano com os campos públicos vinculados", () => {
    const project = structuredClone(findDemoProject("demo-casa-sucos")!);
    const questions = [{ id: "q1", question: "Qual a necessidade?", type: "text" as const, purpose: "need" as const, required: true }, { id: "q2", question: "Quando?", type: "text" as const, purpose: "context" as const, required: false }];
    project.discoveryPlan = { id: "plan", version: 1, setupSessionId: "session", contextSignature: "signature", declaredObjective: "contato", journeyMode: "assisted_discovery", primaryAction: { key: "contact", label: "Contato" }, completionAction: { label: "Continuar", destination: "whatsapp" }, offerings: [{ id: "a", name: "A" }, { id: "b", name: "B" }], offerIntelligenceProfiles: [], questions, fallbackStrategy: { kind: "team_handoff", explanation: "Equipe" }, provenance: { source: "contextual_ai", providerOperation: "composeDiscoveryPlan", createdAt: new Date().toISOString() }, status: "ready", issues: [] };
    project.steps = [{ ...project.steps[0], settings: { discoveryPlanId: "plan" }, formFields: [{ id: "q1", key: "need", label: "Qual a necessidade?", type: "text", required: true }, { id: "q2", key: "when", label: "Quando?", type: "text", required: false }] }];
    const updated = withDiscoveryQuestions(project, [{ ...questions[1], question: "Para quando?", required: true }, questions[0]]);
    expect(updated.steps[0].formFields?.map((field) => field.id)).toEqual(["q2", "q1"]);
    expect(updated.steps[0].formFields?.[0]).toMatchObject({ label: "Para quando?", required: true, key: "when" });
    expect(updated.discoveryPlan?.provenance.source).toBe("business_confirmed");
  });
});
