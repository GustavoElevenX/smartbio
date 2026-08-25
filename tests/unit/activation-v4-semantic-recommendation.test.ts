import { describe, expect, it } from "vitest";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { buildQualificationQuestionPlan } from "@/features/ai-setup/qualification-proposal";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { applyVisitorActionsToProject, ensureVisitorActionTargets, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import { RuleBasedExperienceComposer } from "@/features/composition/experience-composer";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { recommendService } from "@/features/qualification/recommendation-engine";
import { recommendSections } from "@/features/site-composer/section-recommendation";
import { inferBusinessShape } from "@/features/site-composer/business-shape";
import type { Project, StructuredJourneyQuestion } from "@/types";
import { attachEngineFixtureProfiles } from "../fixtures/offer-intelligence";

const recommendationAction: VisitorActionSelection = {
  key: "recommendation",
  label: "Receber uma recomendação",
  isPrimary: true,
};

const structuredQuestions: StructuredJourneyQuestion[] = [
  { id: "need", question: "O que você mais gostaria de resolver neste momento?", type: "textarea", purpose: "need", required: true },
  { id: "signal", question: "Que resultado seria mais importante para você?", type: "textarea", purpose: "signal", required: true },
  { id: "context", question: "Existe algum detalhe importante para essa escolha?", type: "textarea", purpose: "context", required: false },
];

function discoveryProject(input: { name: string; description: string; offerings: string; questions?: unknown; phone?: string }) {
  const base = new RuleBasedExperienceComposer().compose({
    businessName: input.name,
    businessDescription: input.description,
    primaryGoal: recommendationAction.label,
    primaryDestination: input.phone ? "WhatsApp" : "Formulário",
    slug: input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"),
    phone: input.phone,
  });
  const qualificationStep = base.steps.find((step) => step.type === "form");
  const actionStep = base.steps.find((step) => step.type === "action");
  const choiceStep = base.steps.find((step) => step.type === "choice");
  const scoped: Project = {
    ...base,
    capabilities: base.capabilities?.filter((capability) => capability.key === "qualification"),
    commercialConfig: { qualificationRules: [] },
    dataRequirements: [],
    steps: base.steps.filter((step) => ["welcome", "choice"].includes(step.type) || step.id === qualificationStep?.id || step.id === actionStep?.id).map((step) => step.id === choiceStep?.id
      ? { ...step, options: step.options?.filter((option) => option.value === "qualification") }
      : step),
  };
  const answers = {
    "qualification.objective": "Entender a necessidade e orientar a opção mais adequada.",
    "qualification.offerings": input.offerings,
    "qualification.questions": input.questions ?? structuredQuestions,
    "qualification.outcome": "Com base nas respostas, recomendar uma das ofertas reais e encaminhar o visitante.",
    "qualification.destination": input.phone ? "WhatsApp" : "Formulário",
  };
  const session: AISetupSession = {
    id: "activation-v4",
    workspaceId: "workspace",
    status: "review",
    initialInput: { businessName: input.name, description: input.description, phone: input.phone },
    visitorActions: [recommendationAction],
    actionsConfirmed: true,
    answers,
    missingRequirements: [],
    questions: [],
    sources: [],
    usedFallback: true,
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
  };
  let project = materializeSetupAnswers(scoped, session);
  project = attachEngineFixtureProfiles(project, {
    "higienizacao interna": { strongClues: ["manchas", "odor", "interior"], supporting: ["sujeira interna"] },
    "polimento tecnico": { strongClues: ["perdeu brilho", "marcas superficiais"], supporting: ["aparência da pintura"] },
    "revitalizacao de farois": { strongClues: ["faróis opacos", "faróis amarelados"], supporting: ["transparência dos faróis"] },
    "festa infantil": { strongClues: ["aniversário", "criança"], supporting: ["celebração para crianças"] },
    "mini wedding": { strongClues: ["celebração pequena", "intimista", "poucos convidados"], supporting: ["casamento intimista"] },
    "evento corporativo": { strongClues: ["encontro da empresa", "equipe"], supporting: ["evento empresarial"] },
  });
  project = ensureVisitorActionTargets(project, [recommendationAction]);
  return applyVisitorActionsToProject(project, { visitorActions: [recommendationAction] });
}

const garageServices = "Lavagem detalhada; Higienização interna; Polimento técnico; Vitrificação de pintura; Revitalização de faróis";

describe("Activation V4 — recomendação semântica", () => {
  it("planeja perguntas estruturadas e não fragmenta prosa por pontuação", () => {
    const plan = buildQualificationQuestionPlan({
      initialInput: { businessName: "Oficina", description: "Serviços automotivos e orientação antes do contato." },
      visitorActions: [recommendationAction],
    });
    expect(plan).toHaveLength(3);
    expect(plan.every((question) => question.id && question.question && question.type && question.purpose)).toBe(true);
    expect(plan[0].question).toBe("O que você mais gostaria de resolver neste momento?");

    const project = discoveryProject({
      name: "Oficina Horizonte",
      description: "Cuidados automotivos com orientação por necessidade.",
      offerings: garageServices,
      questions: "faróis ou cuidado geral? O que você percebe: manchas; odor, pintura",
      phone: "5511987654321",
    });
    const fields = project.steps.find((step) => step.type === "form")?.formFields || [];
    expect(fields).toHaveLength(3);
    expect(fields.every((field) => field.label.endsWith("?"))).toBe(true);
    expect(new Set(fields.map((field) => field.label)).size).toBe(3);
  });

  it("preserva todas as ofertas, cria microdescrições e não oferece selector circular em discovery", () => {
    const project = discoveryProject({ name: "Garage 21", description: "Estética automotiva.", offerings: garageServices, phone: "5511987654321" });
    const offerings = project.commercialConfig?.serviceOfferings || [];
    const form = project.steps.find((step) => step.type === "form");
    expect(offerings.map((offering) => offering.name)).toEqual(garageServices.split("; "));
    expect(offerings.every((offering) => Boolean(offering.shortDescription))).toBe(true);
    expect(form?.settings).toMatchObject({ journeyMode: "assisted_discovery" });
    expect(form?.formFields?.some((field) => field.options?.every((option) => offerings.some((offering) => offering.name === option)))).toBe(false);
    expect(recommendSections(inferBusinessShape(project)).some((section) => section.sectionType === "services")).toBe(true);
    expect(project.description).toContain("Lavagem detalhada, Higienização interna, Polimento técnico");
    expect(project.description).not.toContain("Vitrificação de pintura, Revitalização de faróis");
  });

  it.each([
    ["manchas e odor dentro do carro", "Higienização interna"],
    ["a pintura perdeu brilho e possui marcas superficiais", "Polimento técnico"],
    ["os faróis estão opacos e amarelados", "Revitalização de faróis"],
  ])("infere Garage 21 a partir dos sinais: %s", (signal, expected) => {
    const project = discoveryProject({ name: "Garage 21", description: "Estética automotiva.", offerings: garageServices, phone: "5511987654321" });
    const result = recommendService({ need: signal }, project.commercialConfig?.serviceOfferings || [], { journeyMode: "assisted_discovery" });
    expect(result.service?.name).toBe(expected);
    expect(result.reason).toContain(signal);
    expect(result.reason).not.toMatch(/combina diretamente|parece próxima do contexto/i);
  });

  it.each([
    ["aniversário de uma criança de 6 anos", "festa infantil"],
    ["celebração pequena e intimista para poucos convidados", "mini wedding"],
    ["encontro da empresa para a equipe", "evento corporativo"],
  ])("generaliza o match para eventos: %s", (signal, expected) => {
    const project = discoveryProject({
      name: "Espaço Celebra",
      description: "Espaço de eventos que orienta o formato antes da conversa.",
      offerings: "festa infantil; casamento; evento corporativo; mini wedding; locação apenas do espaço",
      phone: "5511987654321",
    });
    expect(recommendService({ event: signal }, project.commercialConfig?.serviceOfferings || [], { journeyMode: "assisted_discovery" }).service?.name).toBe(expected);
  });

  it("mantém escolha explícita sem chamar a opção escolhida de recomendação", () => {
    const project = discoveryProject({ name: "Ateliê", description: "Serviços sob escolha direta.", offerings: "Plano inicial; Plano completo" });
    const result = recommendService({ service: "Plano completo" }, project.commercialConfig?.serviceOfferings || [], { journeyMode: "explicit_choice" });
    expect(result).toMatchObject({ label: "Opção escolhida", title: "Plano completo", confidence: "clear" });
    expect(result.title).not.toMatch(/pode fazer sentido/i);
  });

  it("bloqueia circularidade, fragmentos e vazamento de instrução interna no readiness", () => {
    const project = discoveryProject({ name: "Garage 21", description: "Estética automotiva.", offerings: garageServices, phone: "5511987654321" });
    const circular = structuredClone(project);
    const circularForm = circular.steps.find((step) => step.type === "form");
    if (circularForm) circularForm.formFields = [{ id: "offer", key: "offer", label: "Qual serviço você quer?", type: "select", options: garageServices.split("; "), required: true, purpose: "explicit_choice" }];
    expect(validateConversionPath(circular).checks.find((check) => check.key === "circularity")?.valid).toBe(false);
    expect(getProjectReadiness(circular).publishable).toBe(false);

    const fragment = structuredClone(project);
    const fragmentForm = fragment.steps.find((step) => step.type === "form");
    if (fragmentForm?.formFields?.[0]) fragmentForm.formFields[0].label = "pintura";
    expect(validateConversionPath(fragment).checks.find((check) => check.key === "questions")?.valid).toBe(false);

    const leak = structuredClone(project);
    const result = leak.steps.find((step) => step.type === "recommendation");
    if (result?.recommendation) result.recommendation.description = "Com base nas respostas, recomendar uma das ofertas reais.";
    expect(validateConversionPath(leak).checks.find((check) => check.key === "public_copy")?.valid).toBe(false);
    expect(project.steps.flatMap((step) => [step.title, step.description, step.recommendation?.description]).join(" ")).not.toMatch(/com base nas respostas, recomendar|encaminhar o visitante/i);
  });

  it("usa fallback seguro e normaliza a pendência de WhatsApp na fonte", () => {
    const project = discoveryProject({ name: "Garage 21", description: "Estética automotiva.", offerings: garageServices, phone: "5511987654321" });
    const fallback = recommendService({ need: "não tenho certeza ainda" }, project.commercialConfig?.serviceOfferings || [], { journeyMode: "assisted_discovery" });
    expect(fallback.confidence).toBe("uncertain");
    expect(fallback.service).toBeUndefined();
    expect(getProjectReadiness(project).blocking.filter((item) => /phone|whatsapp/i.test(item.key))).toHaveLength(0);

    const invalid = structuredClone(project);
    invalid.phone = "123";
    for (const destination of invalid.commercialConfig?.routingDestinations || []) if (destination.type === "whatsapp") destination.value = "123";
    for (const step of invalid.steps) for (const option of step.options || []) if (option.actionType === "open_whatsapp") option.actionPayload = { ...option.actionPayload, phone: "123" };
    expect(getProjectReadiness(invalid).blocking.filter((item) => item.key === "contact.whatsapp")).toHaveLength(1);
  });
});
