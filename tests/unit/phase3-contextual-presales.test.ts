import { describe, expect, it } from "vitest";
import { buildIntentCollectionPlan } from "@/features/qualification/intent-collection-plan";
import { buildCommercialBriefing } from "@/features/handoff/commercial-briefing";
import { formatVisitorHandoff } from "@/features/handoff/handoff-formatter";
import { addJourneyQuestion, editJourneyQuestion, editableQuestionsForGoal, removeJourneyQuestion } from "@/features/simple-settings/journey-questions";
import { findDemoProject } from "@/data/demo-projects";
import type { FormField } from "@/types";

const field = (key: string, label: string): FormField => ({ id: key, key, label, type: "text", required: true });
const briefing = (goal: string, answers: Array<[string, string]>, pending: string[] = []) => buildCommercialBriefing({
  projectId: "fictitious-project", projectName: "Empresa fictícia", origin: { source: "teste", campaign: "exemplo" }, identity: {},
  intent: { label: goal }, qualification: answers.map(([label, value]) => ({ label, value, include: true, source: "visitor" })), pending,
});

describe("Fase 3: pré-venda contextual", () => {
  it("motopeças sem catálogo coleta pedido específico e não inventa estoque ou aplicação", () => {
    const plan = buildIntentCollectionPlan({ intent: "price_availability", fields: [], answers: {}, hasCatalogItems: false });
    expect(plan.questions.map((item) => item.field.key)).toEqual(["specific_request"]);
    const result = briefing("Consultar pastilha de freio", [["Pedido", "Pastilha para moto XP 2020"]], ["compatibilidade", "preço", "disponibilidade"]);
    expect(result.visitorStatements[0].value).toContain("XP 2020");
    expect(result.pending).toContain("compatibilidade");
    expect(JSON.stringify(result)).not.toMatch(/R\$|em estoque|compativel/i);
  });

  it("revenda B2B usa volume e região já informados e orienta negociação", () => {
    const fields = [field("volume", "Volume mensal"), field("region", "Região")];
    const plan = buildIntentCollectionPlan({ intent: "resale", fields, answers: { volume: "300 caixas" } });
    expect(plan.questions.map((item) => item.field.key)).toEqual(["region"]);
    const result = briefing("Revenda para restaurante", [["Volume mensal", "300 caixas"], ["Região", "Campinas"]], ["condições de fornecimento"]);
    expect(result.nextStep.reason).toContain("condições de fornecimento");
    expect(JSON.stringify(result)).not.toMatch(/margem|frete gratis/i);
  });

  it("cardápio externo abre diretamente, sem formulário", () => {
    const plan = buildIntentCollectionPlan({ intent: "view_products", externalCatalogUrl: "https://example.test/cardapio", fields: [field("unit", "Unidade")], answers: {} });
    expect(plan.directUrl).toBe("https://example.test/cardapio");
    expect(plan.questions).toEqual([]);
  });

  it("clínica pergunta especialidade e período sem solicitar diagnóstico", () => {
    const plan = buildIntentCollectionPlan({ intent: "schedule", fields: [field("specialty", "Especialidade"), field("period", "Período preferido")], answers: {} });
    expect(plan.questions.map((item) => item.field.key)).toEqual(["specialty", "period"]);
    const result = briefing("Consulta particular", [["Especialidade", "Dermatologia"], ["Período", "Manhã"]], ["agenda"]);
    expect(result.pending).toContain("agenda");
    expect(JSON.stringify(result)).not.toMatch(/diagnostico|horario confirmado/i);
  });

  it("serviço profissional captura escopo e prazo sem assumir orçamento", () => {
    const plan = buildIntentCollectionPlan({ intent: "quote", fields: [field("need", "Natureza da demanda"), field("scope", "Escopo aproximado"), field("deadline", "Prazo desejado")], answers: { need: "Revisão contratual" } });
    expect(plan.questions.map((item) => item.field.key)).toEqual(["scope", "deadline"]);
    const result = briefing("Orçamento", [["Demanda", "Revisão contratual"], ["Escopo", "12 páginas"]], ["prazo", "valor"]);
    expect(result.visitorStatements).toHaveLength(2);
    expect(result.pending).toEqual(["prazo", "valor"]);
  });

  it("usa o mesmo contexto na mensagem e no briefing, sem promover suposições a fatos", () => {
    const context = {
      projectId: "p1", projectName: "Motopeças Exemplo", origin: { source: "instagram", campaign: "freios" }, identity: {},
      intent: { label: "Consultar peça", visitorRequest: "Pastilha para moto XP 2020" },
      qualification: [{ label: "Pedido", value: "Pastilha para moto XP 2020", include: true, source: "visitor" as const }],
      pending: ["compatibilidade", "preço", "disponibilidade"],
    };
    const message = formatVisitorHandoff(context);
    const result = buildCommercialBriefing(context);
    expect(message).toContain("Pastilha para moto XP 2020");
    expect(result.visitorStatements).toEqual([{ label: "Pedido", value: "Pastilha para moto XP 2020" }]);
    expect(result.confirmedFacts).toEqual([]);
    expect(result.pending).toEqual(["compatibilidade", "preço", "disponibilidade"]);
  });

  it("permite revisar, remover e adicionar perguntas da jornada no Simples", () => {
    const project = structuredClone(findDemoProject("demo-casa-sucos")!);
    const goal = project.conversionGoals!.find((item) => /revenda/i.test(item.name))!;
    const orderGoal = project.conversionGoals!.find((item) => item.kind === "buy")!;
    expect(editableQuestionsForGoal(project, orderGoal)).toEqual([]);
    const questions = editableQuestionsForGoal(project, goal);
    expect(questions.length).toBeGreaterThan(0);
    const first = questions[0];
    const edited = editJourneyQuestion(project, first.stepId, first.field.id, { label: "Qual volume mensal você procura?" });
    expect(editableQuestionsForGoal(edited, goal)[0].field.label).toBe("Qual volume mensal você procura?");
    const removed = removeJourneyQuestion(edited, first.stepId, first.field.id);
    expect(editableQuestionsForGoal(removed, goal).some((item) => item.field.id === first.field.id)).toBe(false);
    const added = addJourneyQuestion(removed, first.stepId, "Qual região? ");
    expect(editableQuestionsForGoal(added, goal).some((item) => item.field.label === "Qual região? ")).toBe(true);
  });

  it("pede revisão de perguntas genéricas e não repete respostas anteriores", () => {
    const plan = buildIntentCollectionPlan({ intent: "quote", fields: [field("need", "O que você mais gostaria de resolver neste momento?"), field("scope", "Escopo aproximado"), field("deadline", "Prazo desejado")], answers: { scope: "12 páginas" } });
    expect(plan.questions.map((item) => item.field.key)).toEqual(["deadline"]);
  });
});
