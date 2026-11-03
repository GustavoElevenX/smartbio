import { describe, expect, it } from "vitest";

import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { reconcileProjectWithCommercialArchitecture, validateArchitectureRuntimeContract } from "@/features/ai-setup/architecture-materialization";
import { activationUnderstandingFromCommercialArchitecture, capabilitiesFromCommercialArchitecture, normalizeCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { isFormFieldVisible } from "@/features/forms/form-field-utils";
import { buildJourneyHandoff } from "@/features/handoff/journey-handoff";
import { locationEligibilityIssue } from "@/features/routing/location-eligibility";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { createCapability } from "@/features/capabilities/capability-registry";
import { CompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { journeyComposer } from "@/features/composition/journey-composer";
import { visualComposer } from "@/features/composition/visual-composer";
import type { ExperienceCompositionInput } from "@/types";
import { attachEngineFixtureProfiles } from "../fixtures/offer-intelligence";

const evidence = [{ sourceId: "user", origin: "user" as const, excerpt: "Confirmado", confidence: 1 }];
const input: ExperienceCompositionInput = { businessName: "Casa Aurora", businessDescription: "Presentes personalizados e encomendas", primaryGoal: "Fazer encomenda", primaryDestination: "WhatsApp", phone: "+5511987654321", slug: "casa-aurora" };

function architecture(): CommercialArchitecture {
  return {
    status: "ready",
    confidence: 1,
    businessSummary: { whatItSells: "Presentes personalizados e encomendas sob medida.", commercialModel: "Venda direta e atendimento por WhatsApp.", evidence },
    offerings: [
      { id: "produto-presente", name: "Presente personalizado", kind: "product", evidence, confidence: 1 },
      { id: "servico-curadoria", name: "Curadoria de presentes", kind: "service", evidence, confidence: 1 },
    ],
    audienceContexts: [],
    channels: [
      { id: "wa", type: "whatsapp", label: "WhatsApp", value: "+5511987654321", purpose: "Encomendas", isFallback: false, evidence, confidence: 1 },
      { id: "catalogo", type: "external_url", label: "Catálogo", value: "https://casaaurora.com.br/catalogo", purpose: "Catálogo", isFallback: false, evidence, confidence: 1 },
    ],
    locations: [],
    intents: [
      { id: "encomenda", semanticKey: "order", label: "Fazer encomenda", visitorNeed: "Informar o presente e a quantidade", priority: 100, visibleOnEntry: true, evidence, confidence: 1 },
      { id: "catalogo", semanticKey: "view_products", label: "Ver catálogo", visitorNeed: "Conhecer os produtos", priority: 90, visibleOnEntry: true, evidence, confidence: 1 },
    ],
    journeyBlueprints: [
      { id: "bp-encomenda", intentId: "encomenda", objective: "Receber uma encomenda", mode: "guided_flow", steps: [{ purpose: "Detalhes da encomenda", expectedCapability: null, collects: ["Produto desejado", "Quantidade"], usesOfferings: ["produto-presente", "servico-curadoria"], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa", destinationStrategy: "fixed", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 1 },
      { id: "bp-catalogo", intentId: "catalogo", objective: "Abrir catálogo", mode: "direct_external", steps: [{ purpose: "Abrir o catálogo", expectedCapability: null, collects: [], usesOfferings: ["produto-presente"], usesLocations: [] }], completion: { type: "external_url", channelId: "catalogo", destinationStrategy: "external_url", handoffSummary: false }, requiredFacts: [], assumptions: [], confidence: 1 },
    ],
    issues: [],
  };
}

describe("architecture materialization contract", () => {
  it("limita modalidades de pedido à operação confirmada das unidades", () => {
    const current = architecture();
    current.locations = [{ id: "centro", label: "Centro", address: null, channelIds: ["wa"], evidence, confidence: 1, supportsDelivery: false, supportsPickup: true }];
    current.journeyBlueprints[0].completion = { type: "whatsapp", channelId: null, destinationStrategy: "by_location", handoffSummary: true };
    current.journeyBlueprints[0].steps[0].fields = [{ key: "fulfillment", label: "Modalidade", type: "select", required: true, options: ["delivery", "pickup", "digital", "external"], showWhen: null }];
    expect(normalizeCommercialArchitecture(current).journeyBlueprints[0].steps[0].fields?.[0].options).toEqual(["pickup"]);
  });
  it("preserva descrição longa, preço, horários, modalidades e campos condicionais", () => {
    const current = architecture();
    current.businessSummary.whatItSells = "Informação importante do negócio. ".repeat(40);
    current.offerings[0] = { ...current.offerings[0], price: 24, priceMode: "fixed", description: "Produto confirmado" };
    current.locations = [{ id: "centro", label: "Centro", address: null, channelIds: ["wa"], evidence, confidence: 1, supportsDelivery: false, supportsPickup: true, openingHours: [{ weekday: 1, opensAt: "18:00", closesAt: "23:00", isClosed: false }] }];
    current.journeyBlueprints[0].steps[0].collects = ["Modalidade", "Endereço"];
    current.journeyBlueprints[0].steps[0].fields = [
      { key: "fulfillment", label: "Modalidade", type: "select", required: true, options: ["delivery", "pickup"], showWhen: null },
      { key: "address", label: "Endereço", type: "text", required: true, options: [], showWhen: { field: "fulfillment", values: ["delivery"] } },
    ];
    const normalized = normalizeCommercialArchitecture(current);
    const result = journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), capabilitiesFromCommercialArchitecture(normalized), normalized);
    expect(result.commercialConfig.catalogItems?.[0].price).toBe(24);
    const location = result.commercialConfig.locations![0];
    expect(location.openingHours[0].opensAt).toBe("18:00");
    expect(location.supportsPickup).toBe(true);
    expect(locationEligibilityIssue(location, { fulfillment: "delivery" })).toContain("não atende");
    const fields = result.steps.flatMap((step) => step.formFields || []);
    const address = fields.find((field) => field.key === "address")!;
    expect(isFormFieldVisible(address, { fulfillment: "pickup" })).toBe(false);
    expect(isFormFieldVisible(address, { fulfillment: "delivery" })).toBe(true);
    const handoff = buildJourneyHandoff({ fields, answers: { fulfillment: "pickup", address: "Resposta antiga" } });
    expect(handoff.answers).not.toHaveProperty("Endereço");
  });

  it("qualificar um orçamento não obriga recomendação de produtos", () => {
    const current = architecture();
    current.journeyBlueprints[0].mode = "qualification";
    current.intents[0].semanticKey = "quote";
    expect(activationUnderstandingFromCommercialArchitecture(current).needsAssistedDiscovery).toBe(false);
  });

  it("mostra produtos selecionáveis sem exigir canal externo nem enviar pedido ao explorar catálogo", () => {
    const current = architecture();
    const blueprint = current.journeyBlueprints[1];
    blueprint.mode = "guided_flow";
    blueprint.completion = { type: "native", channelId: null, destinationStrategy: "native", handoffSummary: false };
    const result = journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), [], current);
    const browse = result.steps.find((step) => step.settings?.blueprintId === blueprint.id)!;
    expect(browse.type).toBe("catalog");
    expect(browse.blocks?.map((block) => block.type)).toEqual(["catalog_item_cards", "cart_summary"]);
    expect(browse.options?.[0]).toMatchObject({ label: "Voltar ao início", targetStepId: result.steps[0].id });
    expect(result.steps.filter((step) => step.settings?.blueprintId === blueprint.id)).toHaveLength(1);
    current.journeyBlueprints[0].steps[0].expectedCapability = "catalog_order";
    const catalog = journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), [], current).steps.find((step) => step.type === "catalog")!;
    expect(catalog.options?.[0].actionType).toBe("continue_with_answers");
    expect(catalog.options?.[0].actionPayload?.requiresCart).toBe(true);
  });
  it("oferece as intenções na entrada, por prioridade, sem repetir o menu", () => {
    const current = architecture();
    current.intents.reverse();
    const result = journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), [], current);
    expect(result.steps[0].options?.map((option) => option.label)).toEqual(["Fazer encomenda", "Ver catálogo"]);
    expect(result.steps.some((step) => step.type === "choice")).toBe(false);
    expect(result.steps[0].options?.[0].targetStepId).toBe(result.steps.find((step) => step.settings?.blueprintId === "bp-encomenda")?.id);
    expect(result.steps[0].options?.[1].actionType).toBe("open_url");
  });

  it("preserva variantes e IDs existentes ao ligar o catálogo da jornada", async () => {
    const current = architecture();
    const blueprint = current.journeyBlueprints[1];
    blueprint.mode = "catalog";
    blueprint.steps[0].expectedCapability = "catalog_order";
    blueprint.completion = { type: "native", channelId: null, destinationStrategy: "native", handoffSummary: false };
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const capabilities = capabilitiesFromCommercialArchitecture(current);
    const project = await new CompositionOrchestrator({ analyze: () => profile }, { plan: () => capabilities }, journeyComposer, visualComposer, undefined, current).compose(input);
    project.commercialConfig!.catalogItems![0].variants = [{ id: "sabor-laranja", name: "Laranja", priceDelta: 0, isAvailable: true }];
    const originalId = project.commercialConfig!.catalogItems![0].id;
    const reconciled = reconcileProjectWithCommercialArchitecture({ project, architecture: current, compositionInput: input, profile, capabilities });
    expect(reconciled.commercialConfig?.catalogItems?.[0]).toMatchObject({ id: originalId, variants: [{ id: "sabor-laranja", name: "Laranja" }] });
    const catalog = reconciled.steps.find((step) => step.type === "catalog")!;
    expect(catalog.blocks?.find((block) => block.type === "catalog_item_cards")?.content?.itemIds).toEqual([originalId]);
    expect(validateArchitectureRuntimeContract(current, reconciled).valid).toBe(true);
  });

  it("usa o questionário de descoberta uma vez e mantém os campos confirmados", async () => {
    const current = architecture();
    current.intents[0].semanticKey = "recommendation";
    current.journeyBlueprints[0].mode = "qualification";
    current.journeyBlueprints[0].steps = [{ purpose: "Entender o contexto", expectedCapability: "qualification", collects: ["Seu contexto"], fields: [{ key: "contexto", label: "Seu contexto", type: "select", required: true, options: ["Pessoal", "Empresa"], showWhen: null }], usesOfferings: [], usesLocations: [] }];
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const capabilities = capabilitiesFromCommercialArchitecture(current);
    const project = await new CompositionOrchestrator({ analyze: () => profile }, { plan: () => capabilities }, journeyComposer, visualComposer, undefined, current).compose(input);
    attachEngineFixtureProfiles(project, {});
    const form = project.steps.find((step) => step.type === "form")!;
    form.settings = { ...form.settings, discoveryPlanId: project.discoveryPlan!.id };
    project.steps.push({ id: "recommendation", type: "recommendation", title: "Opção para você", order: project.steps.length, isActive: true });
    const reconciled = reconcileProjectWithCommercialArchitecture({ project, architecture: current, compositionInput: input, profile, capabilities });
    const forms = reconciled.steps.filter((step) => step.type === "form" && step.settings?.blueprintId === "bp-encomenda");
    expect(forms).toHaveLength(1);
    expect(forms[0].formFields?.map((field) => field.key)).toEqual(["contexto"]);
    expect(forms[0].options?.[0].targetStepId).toBe("recommendation");
    const ids = new Set(reconciled.steps.map((step) => step.id));
    expect(reconciled.steps.flatMap((step) => step.options || []).every((option) => !option.targetStepId || ids.has(option.targetStepId))).toBe(true);
    expect(validateArchitectureRuntimeContract(current, reconciled).valid).toBe(true);
  });
  it("restaura campos confirmados, ofertas e entradas diretas depois de transformações posteriores", async () => {
    const current = architecture();
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const capabilities = capabilitiesFromCommercialArchitecture(current);
    const generated = await new CompositionOrchestrator({ analyze: () => profile }, { plan: () => capabilities }, journeyComposer, visualComposer, undefined, current).compose(input);
    const corrupted = { ...generated, steps: generated.steps.map((step) => step.type === "form" ? { ...step, formFields: [{ id: "generic", key: "necessidade", label: "Qual é a sua necessidade?", type: "text" as const, required: true }] } : step) };
    const reconciled = reconcileProjectWithCommercialArchitecture({ project: corrupted, architecture: current, compositionInput: input, profile, capabilities });

    expect(reconciled.steps.flatMap((step) => step.formFields || []).map((field) => field.label)).toEqual(["Produto desejado", "Quantidade"]);
    expect(reconciled.commercialConfig?.catalogItems?.map((item) => item.name)).toEqual(["Presente personalizado"]);
    expect(reconciled.commercialConfig?.serviceOfferings?.map((item) => item.name)).toEqual(["Curadoria de presentes"]);
    expect(reconciled.conversionGoals).toHaveLength(2);
    expect(reconciled.conversionGoals?.every((goal) => reconciled.steps.some((step) => step.id === goal.targetStepId && step.type !== "choice"))).toBe(true);
    expect(reconciled.steps.filter((step) => step.settings?.blueprintId === "bp-catalogo")).toHaveLength(1);
    expect(reconciled.steps.find((step) => step.settings?.blueprintId === "bp-catalogo")?.type).toBe("action");
    expect(reconciled.commercialConfig?.catalogItems?.[0]?.metadata.priceMode).toBe("manual");
    expect(reconciled.commercialConfig?.serviceOfferings?.[0]?.destinationId).toBeTruthy();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect([
      ...(reconciled.conversionGoals || []).map((item) => item.id),
      ...(reconciled.commercialConfig?.catalogCategories || []).map((item) => item.id),
      ...(reconciled.commercialConfig?.catalogItems || []).map((item) => item.id),
      ...(reconciled.commercialConfig?.serviceOfferings || []).map((item) => item.id),
      ...(reconciled.commercialConfig?.routingDestinations || []).map((item) => item.id),
    ].every((id) => uuid.test(id))).toBe(true);
    expect(validateArchitectureRuntimeContract(current, reconciled).valid).toBe(true);
  });

  it("materializa escolha de unidade como seletor real e preserva as rotas por UUID", async () => {
    const current = architecture();
    current.locations = [
      { id: "centro", label: "Centro", address: null, channelIds: ["wa-centro"], evidence, confidence: 1 },
      { id: "praia", label: "Praia", address: null, channelIds: ["wa-praia"], evidence, confidence: 1 },
    ];
    current.channels = [
      { id: "wa", type: "whatsapp", label: "WhatsApp principal", value: "+5511987654321", purpose: "Atendimento geral", isFallback: true, evidence, confidence: 1 },
      { id: "wa-centro", type: "whatsapp", label: "WhatsApp Centro", value: "+5511987654101", purpose: "Centro", isFallback: false, evidence, confidence: 1 },
      { id: "wa-praia", type: "whatsapp", label: "WhatsApp Praia", value: "+5511987654102", purpose: "Praia", isFallback: false, evidence, confidence: 1 },
    ];
    current.intents = [{ id: "unidade", semanticKey: "contact", label: "Falar com uma unidade", visitorNeed: "Escolher a unidade", priority: 100, visibleOnEntry: true, evidence, confidence: 1 }];
    current.journeyBlueprints = [{ id: "bp-unidade", intentId: "unidade", objective: "Encaminhar por unidade", mode: "routing", steps: [
      { purpose: "Escolher a unidade", expectedCapability: null, collects: ["unidade desejada"], usesOfferings: [], usesLocations: ["centro", "praia"] },
      { purpose: "Abrir o WhatsApp", expectedCapability: null, collects: [], usesOfferings: [], usesLocations: ["centro", "praia"] },
    ], completion: { type: "whatsapp", channelId: null, destinationStrategy: "by_location", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 1 }];
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const capabilities = capabilitiesFromCommercialArchitecture(current);
    const generated = await new CompositionOrchestrator({ analyze: () => profile }, { plan: () => capabilities }, journeyComposer, visualComposer, undefined, current).compose(input);
    const reconciled = reconcileProjectWithCommercialArchitecture({ project: generated, architecture: current, compositionInput: input, profile, capabilities });
    const routeStep = reconciled.steps.find((step) => step.settings?.blueprintId === "bp-unidade" && step.type === "routing");

    expect(routeStep?.blocks?.some((block) => block.type === "location_selector")).toBe(true);
    expect(routeStep?.formFields).toEqual([]);
    expect(reconciled.commercialConfig?.locations).toHaveLength(2);
    expect(reconciled.commercialConfig?.routingRules).toHaveLength(2);
    expect(validateArchitectureRuntimeContract(current, reconciled)).toEqual({ valid: true, issues: [] });
  });

  it("não habilita agenda nativa quando a jornada termina por WhatsApp", async () => {
    const current = architecture();
    current.intents = [{ id: "agenda", semanticKey: "schedule", label: "Agendar avaliação", visitorNeed: "Falar com a equipe para agendar", priority: 100, visibleOnEntry: true, evidence, confidence: 1 }];
    current.journeyBlueprints = [{ id: "bp-agenda", intentId: "agenda", objective: "Agendar avaliação", mode: "scheduling", steps: [{ purpose: "Escolher horário", expectedCapability: "scheduling", collects: [], usesOfferings: [], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa", destinationStrategy: "fixed", handoffSummary: false }, requiredFacts: [], assumptions: [], confidence: 1 }];
    const capabilities = capabilitiesFromCommercialArchitecture(current, [createCapability("scheduling")]);
    const profile = new RuleBasedBusinessAnalyzer().analyze(input);
    const project = await new CompositionOrchestrator({ analyze: () => profile }, { plan: () => capabilities }, journeyComposer, visualComposer, undefined, current).compose(input);
    const reconciled = reconcileProjectWithCommercialArchitecture({ project, architecture: current, compositionInput: input, profile, capabilities });

    expect(capabilities.some((item) => item.key === "scheduling")).toBe(false);
    expect(reconciled.steps.some((step) => step.type === "schedule" || step.blocks?.some((block) => block.type === "schedule_slots"))).toBe(false);
    expect(reconciled.conversionGoals?.[0]?.targetStepId).toBe(reconciled.steps.find((step) => step.settings?.blueprintId === "bp-agenda")?.id);
    expect(validateArchitectureRuntimeContract(current, reconciled).valid).toBe(true);
  });
});
