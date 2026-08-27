import { describe, expect, it } from "vitest";

import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";
import {
  isRequiredFactResolved,
  reconcileCommercialArchitectureRequirements,
  resolveArchitectureRequirement,
  validateCommercialArchitectureForMaterialization,
} from "@/features/ai-setup/architecture-resolution";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { validateCommercialRuntimeConsistency } from "@/features/commercial-context/commercial-runtime-consistency";
import { commercialContextForAI, projectCommercialContextFromActivation } from "@/features/commercial-context/project-commercial-context";
import { CompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { journeyComposer } from "@/features/composition/journey-composer";
import { buildJourneyHandoff } from "@/features/handoff/journey-handoff";
import { evaluateCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { validateConversionPath } from "@/features/publishing/conversion-path-validator";
import { resolveRoute } from "@/features/routing/routing-engine";
import { resolveCompletionDestination, semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import type { BusinessLocation, Project, RoutingDestination } from "@/types";
import { requirementsFromCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { AISetupService } from "@/server/ai-setup/ai-setup-service";
import type { AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import type { AISetupActor } from "@/server/auth/setup-actor";

const evidence = [{ sourceId: "user", origin: "user" as const, excerpt: "Confirmado pelo negócio", confidence: 1 }];

function channel(id: string, value: string, type: "whatsapp" | "external_url" | "phone" | "email" = "whatsapp", isFallback = false): CommercialArchitecture["channels"][number] {
  return { id, type, label: id, value, purpose: "Atendimento", isFallback, evidence, confidence: 1 };
}

function location(id: string, channelIds: string[] = []): CommercialArchitecture["locations"][number] {
  return { id, label: `Unidade ${id.toUpperCase()}`, address: null, channelIds, evidence, confidence: 1 };
}

function architecture(input: {
  mode?: CommercialArchitecture["journeyBlueprints"][number]["mode"];
  strategy?: CommercialArchitecture["journeyBlueprints"][number]["completion"]["destinationStrategy"];
  channels?: CommercialArchitecture["channels"];
  locations?: CommercialArchitecture["locations"];
  channelId?: string | null;
  completionType?: CommercialArchitecture["journeyBlueprints"][number]["completion"]["type"];
  collects?: string[];
  requiredFacts?: CommercialArchitecture["journeyBlueprints"][number]["requiredFacts"];
  steps?: CommercialArchitecture["journeyBlueprints"][number]["steps"];
  semanticKey?: CommercialArchitecture["intents"][number]["semanticKey"];
} = {}): CommercialArchitecture {
  const mode = input.mode || "guided_flow";
  const strategy = input.strategy || "fixed";
  const steps = input.steps || [{ purpose: "Coletar contexto", expectedCapability: null, collects: input.collects || ["Quantidade"], usesOfferings: [], usesLocations: (input.locations || []).map((item) => item.id) }];
  const completionType = input.completionType || (strategy === "external_url" ? "external_url" : strategy === "native" ? "native" : input.channels?.find((item) => item.id === input.channelId)?.type || "whatsapp");
  return {
    status: input.requiredFacts?.length ? "needs_confirmation" : "ready",
    confidence: 0.95,
    businessSummary: { whatItSells: "Produtos e serviços", commercialModel: "Atendimento contextual", evidence },
    offerings: [], audienceContexts: [],
    channels: input.channels || [],
    locations: input.locations || [],
    intents: [{ id: "intent-main", semanticKey: input.semanticKey ?? "contact", label: "Continuar atendimento", visitorNeed: "Receber atendimento", priority: 100, visibleOnEntry: true, evidence, confidence: 0.95 }],
    journeyBlueprints: [{ id: "blueprint-main", intentId: "intent-main", objective: "Receber atendimento", mode, steps, completion: { type: completionType, channelId: input.channelId ?? null, destinationStrategy: strategy, handoffSummary: (input.collects || []).length > 0 }, requiredFacts: input.requiredFacts || [], assumptions: [], confidence: 0.95 }],
    issues: [],
  };
}

function profile() {
  return new RuleBasedBusinessAnalyzer().analyze({ businessName: "Teste", businessDescription: "Atendimento comercial contextual por WhatsApp", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "teste" });
}

describe("Activation hardening — resolução estrutural de blockers", () => {
  it("materializa URL externa, liga o blueprint e remove o blocker", () => {
    const fact = { key: "architecture.intent-main.url", label: "Cardápio", reason: "Falta URL", affects: "Cardápio", severity: "blocking" as const, resolutionTarget: { type: "external_url" as const, blueprintId: "blueprint-main", intentId: "intent-main" } };
    const before = architecture({ mode: "direct_external", strategy: "external_url", collects: [], requiredFacts: [fact] });
    const result = resolveArchitectureRequirement({ architecture: before, requirement: fact, answer: "https://menu.example.com", sourceId: "session-1" });
    const blueprint = result.architecture.journeyBlueprints[0];
    const linked = result.architecture.channels.find((item) => item.id === blueprint.completion.channelId);
    expect(result.resolved).toBe(true);
    expect(linked).toMatchObject({ type: "external_url", value: "https://menu.example.com" });
    expect(blueprint.completion.destinationStrategy).toBe("external_url");
    expect(blueprint.requiredFacts).toHaveLength(0);
    expect(result.architecture.status).toBe("ready");
  });

  it("não resolve URL ou telefone inválidos", () => {
    const urlFact = { key: "architecture.intent-main.url", label: "Link", reason: "Falta link", affects: "Link", severity: "blocking" as const, resolutionTarget: { type: "external_url" as const, blueprintId: "blueprint-main", intentId: "intent-main" } };
    const urlResult = resolveArchitectureRequirement({ architecture: architecture({ mode: "direct_external", strategy: "external_url", collects: [], requiredFacts: [urlFact] }), requirement: urlFact, answer: "menu sem protocolo" });
    expect(urlResult.resolved).toBe(false);
    expect(urlResult.architecture.channels).toHaveLength(0);

    const phoneFact = { key: "architecture.intent-main.destination", label: "WhatsApp", reason: "Falta WhatsApp", affects: "Contato", severity: "blocking" as const, resolutionTarget: { type: "channel_value" as const, channelId: null, intentId: "intent-main", channelType: "whatsapp" as const } };
    const phoneResult = resolveArchitectureRequirement({ architecture: architecture({ requiredFacts: [phoneFact] }), requirement: phoneFact, answer: "123" });
    expect(phoneResult.resolved).toBe(false);
    expect(phoneResult.architecture.channels).toHaveLength(0);
  });

  it("materializa WhatsApp confirmado com evidência do usuário", () => {
    const fact = { key: "architecture.intent-main.destination", label: "WhatsApp", reason: "Falta WhatsApp", affects: "Contato", severity: "blocking" as const, resolutionTarget: { type: "channel_value" as const, channelId: null, intentId: "intent-main", channelType: "whatsapp" as const } };
    const result = resolveArchitectureRequirement({ architecture: architecture({ requiredFacts: [fact] }), requirement: fact, answer: "(11) 99999-9999", sourceId: "session-confirmed" });
    expect(result.resolved).toBe(true);
    expect(result.architecture.channels[0].value).toBe("+5511999999999");
    expect(result.architecture.channels[0].evidence.at(-1)).toMatchObject({ sourceId: "session-confirmed", origin: "user", confidence: 1 });
    expect(isRequiredFactResolved(result.architecture, fact)).toBe(true);
  });

  it("faz o pipeline de answer persistir a arquitetura resolvida, não apenas a resposta", async () => {
    const fact = { key: "architecture.intent-main.destination", label: "WhatsApp", reason: "Falta WhatsApp", affects: "Contato", severity: "blocking" as const, resolutionTarget: { type: "channel_value" as const, channelId: null, intentId: "intent-main", channelType: "whatsapp" as const } };
    const current = architecture({ requiredFacts: [fact] });
    const session = setupSession(current, {} as Project);
    session.status = "waiting_answers";
    session.missingRequirements = requirementsFromCommercialArchitecture(current, session.id);
    const repository = repositoryDouble(session);
    const actor: AISetupActor = { userId: "owner", email: "owner@sobe.test", workspaceId: "workspace", role: "owner", persistence: "memory", mode: "workspace" };
    const updated = await new AISetupService(repository).answer(actor, session.id, fact.key, "(11) 98888-7777");
    expect(updated.answers[fact.key]).toBe("(11) 98888-7777");
    expect(updated.commercialArchitecture?.channels[0].value).toBe("+5511988887777");
    expect(updated.commercialArchitecture?.journeyBlueprints[0].requiredFacts).toHaveLength(0);
    expect(updated.missingRequirements.some((item) => item.key === fact.key)).toBe(false);
  });

  it("mantém multiunidade bloqueada até todas as associações existirem", () => {
    const locations = [location("a", ["wa-a"]), location("b", ["wa-b"]), location("c", ["wa-c"]), location("d")];
    const fact = { key: "architecture.intent-main.location_channels", label: "WhatsApp por unidade", reason: "Falta unidade", affects: "Unidades", severity: "blocking" as const, resolutionTarget: { type: "location_channel_mapping" as const, intentId: "intent-main", locationIds: locations.map((item) => item.id), channelType: "whatsapp" as const } };
    const before = architecture({ mode: "routing", strategy: "by_location", locations, channels: [channel("wa-a", "5511111111111"), channel("wa-b", "5522222222222"), channel("wa-c", "5533333333333")], requiredFacts: [fact], steps: [{ purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: locations.map((item) => item.id) }] });
    expect(validateCommercialArchitectureForMaterialization(before).valid).toBe(false);
    const result = resolveArchitectureRequirement({ architecture: before, requirement: fact, answer: { d: "5544444444444" } });
    expect(result.resolved).toBe(true);
    expect(result.architecture.locations.find((item) => item.id === "d")?.channelIds).toEqual(["channel-whatsapp-d"]);
    expect(validateCommercialArchitectureForMaterialization(result.architecture).valid).toBe(true);
  });

  it("reprova blocker fantasma mesmo quando requiredFacts foi apagado", () => {
    const phantom = architecture({ strategy: "fixed", channelId: null, requiredFacts: [] });
    const gate = validateCommercialArchitectureForMaterialization(phantom);
    expect(gate.valid).toBe(false);
    expect(gate.issues.some((item) => item.code === "invalid_fixed_destination")).toBe(true);
    expect(reconcileCommercialArchitectureRequirements(phantom).journeyBlueprints[0].requiredFacts).toHaveLength(1);
  });
});

describe("Activation hardening — composer, routing e handoff", () => {
  it("mantém direct_external sem formulário e gera open_url", () => {
    const current = architecture({ mode: "direct_external", strategy: "external_url", channels: [channel("menu", "https://menu.example.com", "external_url")], channelId: "menu", collects: [], steps: [] });
    const composed = journeyComposer.compose({ businessName: "Menu", businessDescription: "Cardápio", primaryGoal: "Ver cardápio", primaryDestination: "Site", slug: "menu" }, profile(), [], current);
    const option = composed.steps.find((step) => step.type === "choice")?.options?.find((item) => item.label === "Continuar atendimento");
    expect(option).toMatchObject({ actionType: "open_url", actionPayload: { url: "https://menu.example.com" } });
    expect(composed.steps.some((step) => step.formFields?.length)).toBe(false);
  });

  it("guided_flow avança com respostas sem captura de lead e monta handoff ordenado", () => {
    const current = architecture({ channels: [channel("wa-sales", "5511999999999")], channelId: "wa-sales", collects: ["Data desejada", "Quantidade", "Preferência"] });
    const composed = journeyComposer.compose({ businessName: "Encomendas", businessDescription: "Encomendas", primaryGoal: "Encomendar", primaryDestination: "WhatsApp", slug: "encomendas" }, profile(), [], current);
    const form = composed.steps.find((step) => step.type === "form" && step.formFields?.length);
    expect(form?.options?.[0].actionType).toBe("continue_with_answers");
    expect(form?.options?.[0].targetStepId).toBeTruthy();
    expect(composed.steps.some((step) => step.options?.some((option) => option.actionType === "capture_lead" || option.actionType === "submit_form"))).toBe(false);
    const fields = form?.formFields || [];
    const answers = Object.fromEntries(fields.map((field) => [field.key, field.label === "Data desejada" ? "2026-08-30" : field.label === "Quantidade" ? 3 : ""]));
    const handoff = buildJourneyHandoff({ intent: { label: "Fazer encomenda" }, answers, fields, selectedLocation: { id: "a", name: "Unidade A" } });
    expect(handoff).toMatchObject({ interest: "Fazer encomenda", location: "Unidade A", answers: { "Data desejada": "30/08/2026", Quantidade: "3" } });
    expect(Object.values(handoff.answers)).not.toContain("");
  });

  it("preserva a ordem de um hybrid com perguntas e routing", () => {
    const locations = [location("a", ["wa-a"]), location("b", ["wa-b"])];
    const current = architecture({ mode: "hybrid", strategy: "by_location", channels: [channel("wa-a", "5511111111111"), channel("wa-b", "5522222222222")], locations, steps: [
      { purpose: "Entender o pedido", expectedCapability: null, collects: ["Produto", "Quantidade"], usesOfferings: [], usesLocations: [] },
      { purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: locations.map((item) => item.id) },
    ] });
    const composed = journeyComposer.compose({ businessName: "Híbrido", businessDescription: "Pedido por unidade", primaryGoal: "Pedir", primaryDestination: "WhatsApp", slug: "hibrido" }, profile(), [], current);
    const form = composed.steps.find((step) => step.description === "Entender o pedido");
    const routing = composed.steps.find((step) => step.type === "routing");
    expect(form?.options?.[0]).toMatchObject({ actionType: "continue_with_answers", targetStepId: routing?.id });
    expect(routing?.options?.[0].actionType).toBe("start_capability");
  });

  it("resolve a unidade B sem depender da ordem dos destinations e não usa fallback implícito", () => {
    const destinations: RoutingDestination[] = [channelDestination("wa-a", "5511111111111"), channelDestination("wa-b", "5522222222222")];
    const locations: BusinessLocation[] = [runtimeLocation("a", "wa-a"), runtimeLocation("b", "wa-b")];
    expect(resolveRoute({ location_id: "b" }, [], destinations.toReversed(), undefined, locations).destination?.id).toBe("wa-b");
    expect(resolveRoute({ location_id: "sem-mapping" }, [], destinations, undefined, locations).destination).toBeUndefined();
    expect(resolveRoute({ location_id: "sem-mapping" }, [], destinations, "wa-a", locations).destination).toBeUndefined();
  });

  it("seleciona WhatsApp pela semântica mesmo sendo o terceiro ou o primeiro channel", () => {
    const channels = [channel("phone-b", "5511333333333", "phone"), channel("url-b", "https://booking.example.com", "external_url"), channel("wa-b", "5511999999999")];
    const selected = location("b", channels.map((item) => item.id));
    const current = architecture({ mode: "routing", strategy: "by_location", completionType: "whatsapp", channels, locations: [selected], steps: [{ purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: ["b"] }] });
    const blueprint = current.journeyBlueprints[0];
    expect(resolveCompletionDestination({ architecture: current, blueprint, selectedLocationId: "b" })).toMatchObject({ status: "resolved", channel: { id: "wa-b" } });
    const reversed = { ...current, channels: current.channels.toReversed(), locations: [{ ...selected, channelIds: selected.channelIds.toReversed() }] };
    expect(resolveCompletionDestination({ architecture: reversed, blueprint: reversed.journeyBlueprints[0], selectedLocationId: "b" })).toMatchObject({ status: "resolved", channel: { id: "wa-b" } });
  });

  it("restringe Unidade B e alterna WhatsApp/URL conforme completion.type", () => {
    const channels = [
      channel("wa-a", "5511111111111"), channel("phone-a", "5511222222222", "phone"),
      channel("phone-b", "5522111111111", "phone"), channel("wa-b", "5522999999999"), channel("booking-b", "https://booking.example.com/b", "external_url"),
      channel("url-c", "https://example.com/c", "external_url"), channel("wa-c", "5533999999999"),
    ];
    const locations = [location("a", ["wa-a", "phone-a"]), location("b", ["phone-b", "wa-b", "booking-b"]), location("c", ["url-c", "wa-c"])];
    const whatsapp = architecture({ mode: "routing", strategy: "by_location", completionType: "whatsapp", channels, locations, steps: [{ purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: locations.map((item) => item.id) }] });
    const external = { ...whatsapp, journeyBlueprints: [{ ...whatsapp.journeyBlueprints[0], id: "blueprint-booking", completion: { ...whatsapp.journeyBlueprints[0].completion, type: "external_url" as const } }] };
    expect(resolveCompletionDestination({ architecture: whatsapp, blueprint: whatsapp.journeyBlueprints[0], selectedLocationId: "b" })).toMatchObject({ status: "resolved", channel: { id: "wa-b" } });
    expect(resolveCompletionDestination({ architecture: external, blueprint: external.journeyBlueprints[0], selectedLocationId: "b" })).toMatchObject({ status: "resolved", channel: { id: "booking-b" } });

    const composed = journeyComposer.compose({ businessName: "Rede", businessDescription: "Atendimento por unidade", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "rede" }, profile(), [], whatsapp);
    const runtimeLocation = composed.commercialConfig.locations?.find((item) => item.settings?.architectureId === "b");
    const runtimeDestination = composed.commercialConfig.routingDestinations?.find((item) => item.key === "wa-b");
    const rule = composed.commercialConfig.routingRules?.find((item) => item.condition.value === semanticJourneyRouteKey("blueprint-main", runtimeLocation!.id));
    expect(rule?.destinationId).toBe(runtimeDestination?.id);
    expect(runtimeLocation?.routingDestinationId).toBe(runtimeDestination?.id);
  });

  it("valida continue_with_answers como transição, capture_lead como conclusão e legado como compatível", async () => {
    const current = architecture({ channels: [channel("wa", "5511999999999")], channelId: "wa", collects: ["Contexto"] });
    const project = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, current).compose({ businessName: "Fluxo", businessDescription: "Fluxo guiado", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "fluxo", phone: "5511999999999" });
    expect(validateConversionPath(project).complete).toBe(true);
    const form = project.steps.find((step) => step.formFields?.length);
    const broken: Project = { ...project, steps: project.steps.map((step) => step.id === form?.id ? { ...step, options: step.options?.map((option) => ({ ...option, targetStepId: undefined })) } : step) };
    expect(validateConversionPath(broken).complete).toBe(true); // outros caminhos de entrada ainda podem concluir
    const continueOnly: Project = { ...project, steps: [{ id: "continue", type: "form", title: "Contexto", order: 0, isActive: true, options: [{ id: "next", label: "Continuar", value: "next", actionType: "continue_with_answers" }] }] };
    expect(validateConversionPath(continueOnly).complete).toBe(false);
    const captureOnly: Project = { ...project, steps: [{ id: "lead", type: "form", title: "Contato", order: 0, isActive: true, options: [{ id: "capture", label: "Enviar", value: "lead", actionType: "capture_lead" }] }] };
    expect(validateConversionPath(captureOnly).complete).toBe(true);
    const legacyOnly: Project = { ...captureOnly, steps: [{ ...captureOnly.steps[0], options: [{ id: "legacy", label: "Enviar", value: "lead", actionType: "submit_form" }] }] };
    expect(validateConversionPath(legacyOnly).complete).toBe(true);
  });
});

describe("Activation hardening — memória comercial e cenários obrigatórios", () => {
  it("trata nova tentativa de finalização como sucesso idempotente", async () => {
    const current = architecture({ channels: [channel("wa", "5511999999999")], channelId: "wa", collects: ["Contexto"] });
    const project = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, current).compose({ businessName: "Idempotente", businessDescription: "Atendimento", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "idempotente", phone: "5511999999999" });
    const completed = { ...setupSession(current, project), status: "completed" as const, projectId: project.id };
    const actor: AISetupActor = { userId: "owner", email: "owner@sobe.test", workspaceId: "workspace", role: "owner", persistence: "memory", mode: "workspace" };
    const result = await new AISetupService(repositoryDouble(completed)).finalizeProject(actor, completed.id, project.id, true);
    expect(result.session.status).toBe("completed");
    expect(result.summary).toMatchObject({ alreadyFinalized: 1, applied: 0 });
  });

  it("projeta memória compacta com decisões confirmadas antes de inferências", async () => {
    const current = architecture({ channels: [channel("wa", "5511999999999")], channelId: "wa", collects: ["Contexto"] });
    const project = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, current).compose({ businessName: "Memória", businessDescription: "Atendimento", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "memoria", phone: "5511999999999" });
    const session = setupSession(current, project);
    const context = projectCommercialContextFromActivation({ projectId: project.id, project, session, now: "2026-08-26T12:00:00.000Z" });
    const projection = commercialContextForAI(context);
    expect(projection.confirmedDecisions.length).toBeGreaterThan(0);
    expect(projection.precedence[0]).toBe("latest_user_edit");
    expect(JSON.stringify(projection)).not.toContain("observedAt");
    expect(validateCommercialRuntimeConsistency({ context, project, architecture: current }).valid).toBe(true);
  });

  it("cobre multi-intent/multi-location, B2B, venda consultiva e hotel sem falsa disponibilidade", async () => {
    const locations = [location("a", ["wa-a"]), location("b", ["wa-b"]), location("c", ["wa-c"]), location("d", ["wa-d"])];
    const channels = [channel("menu", "https://menu.example.com", "external_url"), channel("wa-a", "5511111111111"), channel("wa-b", "5522999999999"), channel("wa-c", "5533999999999"), channel("wa-d", "5544999999999"), channel("wa-b2b", "5511988887777")];
    const multi = multiIntentArchitecture(channels, locations);
    const project = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, multi).compose({ businessName: "Operação Mix", businessDescription: "Quatro unidades, encomendas e revenda", primaryGoal: "Atender", primaryDestination: "WhatsApp", slug: "operacao-mix" });
    const context = projectCommercialContextFromActivation({ projectId: project.id, project, session: setupSession(multi, project), now: "2026-08-27T12:00:00.000Z" });
    expect(project.steps.find((step) => step.type === "choice")?.options?.find((option) => option.label === "Ver cardápio")?.actionType).toBe("open_url");
    const runtimeLocation = project.commercialConfig?.locations?.find((item) => item.settings?.architectureId === "b");
    const runtimeDestination = project.commercialConfig?.routingDestinations?.find((item) => item.key === "wa-b");
    expect(context.locationContexts.find((item) => item.id === "location-context-b")?.locationId).toBe(runtimeLocation?.id);
    expect(context.channelContexts.find((item) => item.id === "wa-b")?.destinationId).toBe(runtimeDestination?.id);
    expect(validateCommercialRuntimeConsistency({ context, project, architecture: multi }).valid).toBe(true);
    expect(evaluateCapabilityRequirements(project).filter((item) => item.capability === "routing" && item.status !== "verified")).toEqual([]);
    expect(resolveRoute({ location_id: runtimeLocation?.id }, project.commercialConfig?.routingRules || [], project.commercialConfig?.routingDestinations || [], undefined, project.commercialConfig?.locations || []).destination?.key).toBe("wa-b");
    expect(project.steps.find((step) => step.title === "Fazer encomenda")?.options?.[0].actionType).toBe("continue_with_answers");
    expect(project.steps.find((step) => step.title === "Comprar para revenda")?.options?.[0].actionType).toBe("continue_with_answers");
    expect(project.steps.flatMap((step) => step.formFields || []).every((field) => /^[a-z][a-z0-9_]*$/.test(field.key))).toBe(true);
    expect(project.commercialConfig?.serviceOfferings?.every((service) => typeof service.settings?.blueprintId === "string")).toBe(true);

    const consultive = architecture({ mode: "guided_flow", strategy: "fixed", channels: [channel("seller", "5566666666666")], channelId: "seller", collects: ["Tipo de veículo", "Faixa de preço", "Financiamento"], semanticKey: "recommendation" });
    const consultiveProject = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, consultive).compose({ businessName: "Veículos", businessDescription: "Venda consultiva", primaryGoal: "Encontrar veículo", primaryDestination: "WhatsApp", slug: "veiculos" });
    expect(consultiveProject.steps.find((step) => step.formFields?.length)?.formFields?.map((field) => field.label)).toEqual(["Tipo de veículo", "Faixa de preço", "Financiamento"]);

    const booking = architecture({ mode: "direct_external", strategy: "external_url", channels: [channel("booking", "https://booking.example.com", "external_url")], channelId: "booking", collects: [], steps: [], semanticKey: "reserve" });
    const bookingProject = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, booking).compose({ businessName: "Hotel", businessDescription: "Booking externo", primaryGoal: "Reservar", primaryDestination: "Site", slug: "hotel" });
    expect(bookingProject.steps.flatMap((step) => step.options || []).some((option) => option.actionType === "open_url")).toBe(true);
    expect(bookingProject.steps.some((step) => step.type === "availability" || step.type === "reservation")).toBe(false);

    const guidedBooking = architecture({ mode: "hybrid", strategy: "external_url", completionType: "external_url", channels: [channel("booking-guided", "https://booking.example.com", "external_url")], channelId: "booking-guided", collects: ["Data de entrada", "Data de saída", "Adultos", "Crianças"], steps: [{ purpose: "Encaminhar ao sistema externo", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: [] }], semanticKey: "reserve" });
    const guidedBookingProject = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, guidedBooking).compose({ businessName: "Hotel guiado", businessDescription: "Coleta dados e conclui no booking externo", primaryGoal: "Reservar", primaryDestination: "Site", slug: "hotel-guiado" });
    expect(guidedBookingProject.steps.some((step) => step.type === "routing")).toBe(false);

    const request = architecture({ mode: "hybrid", strategy: "fixed", channels: [channel("hotel-wa", "5577777777777")], channelId: "hotel-wa", collects: ["Data de entrada", "Data de saída", "Quantidade de hóspedes"], semanticKey: "reserve" });
    const requestProject = await new CompositionOrchestrator(undefined, undefined, undefined, undefined, undefined, request).compose({ businessName: "Hotel", businessDescription: "Solicitação via WhatsApp", primaryGoal: "Solicitar hospedagem", primaryDestination: "WhatsApp", slug: "hotel-request" });
    expect(requestProject.steps.find((step) => step.formFields?.length)?.options?.[0].actionType).toBe("continue_with_answers");
    expect(JSON.stringify(requestProject).toLowerCase()).not.toContain("quarto disponível");
  });
});

function channelDestination(id: string, value: string): RoutingDestination {
  return { id, key: id, type: "whatsapp", label: id, value, role: "location_contact" };
}

function runtimeLocation(id: string, routingDestinationId: string): BusinessLocation {
  return { id, projectId: "project", name: `Unidade ${id}`, countryCode: "BR", geocodingStatus: "pending", timezone: "America/Sao_Paulo", openingHours: [], supportsDelivery: false, supportsPickup: true, supportsInPerson: true, priority: 1, isActive: true, routingDestinationId };
}

function setupSession(current: CommercialArchitecture, project: Project): AISetupSession {
  return { id: "session", workspaceId: "workspace", status: "review", initialInput: { businessName: project.name || "Teste", description: project.description || "Atendimento contextual" }, extractedProfile: profile(), commercialArchitecture: current, architectureReviewed: true, architectureEdited: true, visitorActions: [], actionsConfirmed: true, answers: {}, missingRequirements: [], questions: [], sources: [], projectDraft: project, usedFallback: false, createdAt: "2026-08-26T12:00:00.000Z", updatedAt: "2026-08-26T12:00:00.000Z" };
}

function repositoryDouble(initial: AISetupSession) {
  let stored = structuredClone(initial);
  return {
    async get() { return structuredClone(stored); },
    async update(_actor: AISetupActor, next: AISetupSession) { stored = structuredClone(next); return structuredClone(stored); },
    async addMessage() {},
  } as unknown as AISetupRepository;
}

function multiIntentArchitecture(channels: CommercialArchitecture["channels"], locations: CommercialArchitecture["locations"]): CommercialArchitecture {
  const intents: CommercialArchitecture["intents"] = [
    ["menu", "view_products", "Ver cardápio"], ["unit", "contact", "Falar com unidade"], ["order", "order", "Fazer encomenda"], ["b2b", "resale", "Comprar para revenda"],
  ].map(([id, semanticKey, label], index) => ({ id: `intent-${id}`, semanticKey: semanticKey as CommercialArchitecture["intents"][number]["semanticKey"], label, visitorNeed: label, priority: 100 - index * 10, visibleOnEntry: true, evidence, confidence: 0.95 }));
  return {
    status: "ready", confidence: 0.95, businessSummary: { whatItSells: "Produtos", commercialModel: "Autosserviço, unidades e B2B", evidence }, offerings: [
      { id: "off-order", name: "Encomendas", kind: "service", evidence, confidence: 0.95 },
      { id: "off-b2b", name: "Atendimento para revenda", kind: "service", evidence, confidence: 0.95 },
    ], audienceContexts: [], channels, locations, intents, issues: [],
    journeyBlueprints: [
      { id: "bp-menu", intentId: "intent-menu", objective: "Ver cardápio", mode: "direct_external", steps: [], completion: { type: "external_url", channelId: "menu", destinationStrategy: "external_url", handoffSummary: false }, requiredFacts: [], assumptions: [], confidence: 0.95 },
      { id: "bp-unit", intentId: "intent-unit", objective: "Falar com unidade", mode: "routing", steps: [{ purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: locations.map((item) => item.id) }], completion: { type: "whatsapp", channelId: null, destinationStrategy: "by_location", handoffSummary: false }, requiredFacts: [], assumptions: [], confidence: 0.95 },
      { id: "bp-order", intentId: "intent-order", objective: "Fazer encomenda", mode: "hybrid", steps: [{ purpose: "Detalhes da encomenda", expectedCapability: null, collects: ["Produto", "Quantidade", "Data desejada"], usesOfferings: [], usesLocations: [] }, { purpose: "Escolher unidade", expectedCapability: "routing", collects: [], usesOfferings: [], usesLocations: locations.map((item) => item.id) }], completion: { type: "whatsapp", channelId: null, destinationStrategy: "by_location", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 0.95 },
      { id: "bp-b2b", intentId: "intent-b2b", objective: "Qualificar revenda", mode: "qualification", steps: [{ purpose: "Entender a empresa", expectedCapability: null, collects: ["Empresa", "Volume mensal"], usesOfferings: [], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa-b2b", destinationStrategy: "fixed", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 0.95 },
    ],
  };
}
