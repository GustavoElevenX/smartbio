import { describe, expect, it } from "vitest";
import { commercialArchitectureSchema, setupInitialInputSchema, type CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import { prepareFirstVersionArchitecture, capabilitiesFromCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { reconcileCommercialArchitectureRequirements } from "@/features/ai-setup/architecture-resolution";
import { calculateSetupReadiness } from "@/features/ai-setup/setup-readiness";
import { journeyComposer } from "@/features/composition/journey-composer";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { isCatalogSelectionLabel } from "@/features/catalog/catalog-selection-fields";

const evidence = [{ sourceId: "user", origin: "user" as const, excerpt: "Dados de teste", confidence: 1 }];
function architecture(description = "Vendo roupas"): CommercialArchitecture {
  return {
    status: "ready", confidence: 1,
    businessSummary: { whatItSells: description, commercialModel: "Solicitações pelo WhatsApp", evidence },
    offerings: [], audienceContexts: [], locations: [], issues: [],
    channels: [{ id: "wa", type: "whatsapp", label: "WhatsApp principal", value: "+5511987654321", purpose: "Atendimento principal", isFallback: true, evidence, confidence: 1 }],
    intents: [{ id: "compra", semanticKey: "order", label: "Fazer pedido", visitorNeed: "Comprar", priority: 100, visibleOnEntry: true, evidence, confidence: 1 }],
    journeyBlueprints: [{ id: "pedido", intentId: "compra", objective: "Receber solicitações", mode: "catalog", steps: [{ purpose: "Escolher itens", expectedCapability: "catalog_order", collects: ["Item", "Quantidade"], usesOfferings: [], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa", destinationStrategy: "fixed", handoffSummary: true }, requiredFacts: [{ key: "catalog.items", label: "Lista de produtos", reason: "Não há produtos informados", affects: "Pedido", severity: "blocking", resolutionTarget: null }], assumptions: [], confidence: 1 }],
  };
}
function compose(current: CommercialArchitecture) {
  const input = { businessName: "Negócio de teste", businessDescription: current.businessSummary.whatItSells, primaryGoal: current.intents[0].label, primaryDestination: "WhatsApp", phone: "+5511987654321", slug: "teste" };
  return journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), capabilitiesFromCommercialArchitecture(current), current);
}

describe("criação da primeira versão com contexto mínimo", () => {
  it("reconhece escolhas do catálogo sem remover escopo ou quantidade estimada B2B", () => {
    expect(isCatalogSelectionLabel("Produto desejado")).toBe(true);
    for (const label of ["Item", "Itens", "Cor", "Cores", "Sabor", "Sabores"]) expect(isCatalogSelectionLabel(label)).toBe(true);
    expect(isCatalogSelectionLabel("Tamanho selecionado")).toBe(true);
    expect(isCatalogSelectionLabel("Quantidade estimada mensal")).toBe(false);
    expect(isCatalogSelectionLabel("Escopo do projeto")).toBe(false);
  });
  it.each(["Vendo roupas", "Vendo equipamentos", "Faço móveis sob medida", "Vendo sucos naturais"])("cria consulta utilizável sem inventar catálogo: %s", (description) => {
    const original = architecture(description);
    const prepared = prepareFirstVersionArchitecture(original);
    expect(original.intents[0].label).toBe("Fazer pedido");
    expect(prepared.intents[0].label).toBe("Solicitar atendimento");
    expect(prepared.offerings).toEqual([]);
    expect(prepared.journeyBlueprints[0].requiredFacts[0].severity).toBe("warning");
    expect(prepareFirstVersionArchitecture(prepared)).toEqual(prepared);
    const project = compose(prepared);
    expect(project.steps.some((step) => step.type === "catalog")).toBe(false);
    const form = project.steps.find((step) => step.type === "form");
    expect(form?.formFields).toEqual([expect.objectContaining({ key: "interest", type: "textarea", required: false, includeInHandoff: true })]);
    expect(project.steps.some((step) => step.options?.some((option) => option.actionType === "open_whatsapp"))).toBe(true);
  });

  it("não permite consulta sem um destino real e não finge pedido nativo", () => {
    const current = architecture();
    current.channels = [];
    current.journeyBlueprints[0].completion = { type: "native", channelId: null, destinationStrategy: "native", handoffSummary: false };
    const prepared = reconcileCommercialArchitectureRequirements(prepareFirstVersionArchitecture(current));
    expect(prepared.status).toBe("needs_confirmation");
    expect(prepared.journeyBlueprints[0].completion.type).toBe("whatsapp");
    expect(prepared.journeyBlueprints.flatMap((blueprint) => blueprint.requiredFacts)).toContainEqual(expect.objectContaining({ key: "contact.whatsapp.primary", severity: "blocking" }));
  });

  it("unifica consultas de compra equivalentes sem apagar um caminho B2B diferente", () => {
    const current = architecture();
    current.intents.push({ ...current.intents[0], id: "catalogo", semanticKey: "view_products", label: "Ver produtos", priority: 80 });
    current.journeyBlueprints.push({ ...current.journeyBlueprints[0], id: "catalogo-bp", intentId: "catalogo" });
    const prepared = prepareFirstVersionArchitecture(current);
    expect(prepared.intents).toHaveLength(1);
    expect(prepared.journeyBlueprints).toHaveLength(1);
    expect(prepareFirstVersionArchitecture(prepared)).toEqual(prepared);
  });

  it("mantém um catálogo externo que já resolve o atendimento", () => {
    const current = architecture();
    current.channels.push({ id: "menu", type: "external_url", label: "Catálogo real", value: "https://example.com/catalogo", purpose: "Catálogo", isFallback: false, evidence, confidence: 1 });
    current.journeyBlueprints[0] = { ...current.journeyBlueprints[0], mode: "direct_external", steps: [], requiredFacts: [], completion: { type: "external_url", channelId: "menu", destinationStrategy: "external_url", handoffSummary: false } };
    expect(prepareFirstVersionArchitecture(current).journeyBlueprints[0]).toEqual(current.journeyBlueprints[0]);
  });

  it("transporta variações reais para a seleção sem exigir fotos, preço ou descrição", () => {
    const current = architecture();
    current.offerings = [{ id: "camiseta", name: "Camiseta", kind: "product", variants: [{ id: "m-azul", name: "M · Azul", priceDelta: null, isAvailable: null }, { id: "g-preta", name: "G · Preta", priceDelta: null, isAvailable: false }], evidence, confidence: 1 }];
    current.journeyBlueprints[0].steps[0].expectedCapability = null;
    current.journeyBlueprints[0].requiredFacts = [];
    const prepared = prepareFirstVersionArchitecture(commercialArchitectureSchema.parse(current));
    const composed = compose(prepared);
    expect(composed.steps.filter((step) => step.type === "catalog")).toHaveLength(1);
    expect(composed.steps.flatMap((step) => step.formFields || [])).toEqual([]);
    expect(composed.commercialConfig.catalogItems?.[0]).toMatchObject({ name: "Camiseta", price: undefined, variants: [{ id: "m-azul", name: "M · Azul", priceDelta: 0, isAvailable: true }, { id: "g-preta", name: "G · Preta", priceDelta: 0, isAvailable: false }] });
  });

  it("preserva qualificação B2B separada da consulta B2C", () => {
    const current = architecture("Equipamentos para consumidores e empresas");
    current.intents.push({ id: "empresa", semanticKey: "quote", label: "Solicitar proposta para empresa", visitorNeed: "Informar o escopo", priority: 90, visibleOnEntry: true, evidence, confidence: 1 });
    current.journeyBlueprints.push({ id: "b2b", intentId: "empresa", objective: "Receber escopo do projeto", mode: "qualification", steps: [{ purpose: "Descreva o projeto", title: "Sobre sua necessidade", expectedCapability: null, collects: ["Empresa", "Escopo"], fields: [{ key: "company", label: "Empresa", type: "text", required: true, options: [], showWhen: null }, { key: "scope", label: "Escopo", type: "textarea", required: true, options: [], showWhen: null }], usesOfferings: [], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa", destinationStrategy: "fixed", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 1 });
    const prepared = prepareFirstVersionArchitecture(current);
    expect(prepared.journeyBlueprints[1]).toEqual(current.journeyBlueprints[1]);
    const composed = compose(prepared);
    expect(composed.steps.filter((step) => step.settings?.blueprintId === "b2b").flatMap((step) => step.formFields || []).map((field) => field.key)).toEqual(["company", "scope"]);
    expect(composed.steps.filter((step) => step.settings?.blueprintId === "pedido").flatMap((step) => step.formFields || []).map((field) => field.key)).toEqual(["interest"]);
  });

  it("aceita uma frase curta sem transformar incerteza em aprovação automática", () => {
    const initialInput = setupInitialInputSchema.parse({ businessName: "Loja", description: "Vendo roupas" });
    const prepared = prepareFirstVersionArchitecture(architecture());
    expect(calculateSetupReadiness([], { initialInput, commercialArchitecture: prepared, architectureReviewed: false }).readyToGenerate).toBe(false);
    expect(calculateSetupReadiness([], { initialInput, commercialArchitecture: prepared, architectureReviewed: true }).readyToGenerate).toBe(true);
    expect(calculateSetupReadiness([], { initialInput, commercialArchitecture: { ...prepared, status: "degraded" }, architectureReviewed: true }).readyToGenerate).toBe(false);
  });
});
