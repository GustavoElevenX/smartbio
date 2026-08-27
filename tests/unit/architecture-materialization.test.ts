import { describe, expect, it } from "vitest";

import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { reconcileProjectWithCommercialArchitecture, validateArchitectureRuntimeContract } from "@/features/ai-setup/architecture-materialization";
import { capabilitiesFromCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { createCapability } from "@/features/capabilities/capability-registry";
import { CompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { journeyComposer } from "@/features/composition/journey-composer";
import { visualComposer } from "@/features/composition/visual-composer";
import type { ExperienceCompositionInput } from "@/types";

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
