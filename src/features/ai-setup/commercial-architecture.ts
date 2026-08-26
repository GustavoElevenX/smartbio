import {
  commercialArchitectureSchema,
  type ActivationUnderstanding,
  type CommercialArchitecture,
  type CommercialEvidenceRef,
  type ExtractedBusinessSource,
  type VisitorActionSelection,
} from "@/features/ai-setup/ai-setup.schema";
import {
  classifyCustomVisitorAction,
  inferDeclaredVisitorActionKeys,
  visitorActionDefinition,
  type VisitorActionKey,
} from "@/features/ai-setup/visitor-actions";
import { extractExplicitOfferNames } from "@/features/qualification/offer-context";
import type { BusinessCapabilityProfile, CapabilityKey, DataRequirement, ProjectCapability } from "@/types";
import { createCapability } from "@/features/capabilities/capability-registry";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function stableId(prefix: string, value: string, index = 0) {
  const slug = normalized(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return `${prefix}-${slug || index + 1}`;
}

function uniqueBy<T>(values: T[], key: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const current = key(value);
    if (!current || seen.has(current)) return false;
    seen.add(current);
    return true;
  });
}

function evidence(sourceId: string, origin: CommercialEvidenceRef["origin"], excerpt: string, confidence: number): CommercialEvidenceRef {
  return { sourceId, origin, excerpt: excerpt.slice(0, 500), confidence };
}

function phoneFromUrl(value: string) {
  try {
    const url = new URL(value);
    const raw = url.hostname === "wa.me"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("phone");
    const phone = raw?.replace(/\D/g, "");
    return phone && phone.length >= 8 ? phone : undefined;
  } catch {
    return undefined;
  }
}

function sourceText(sources: ExtractedBusinessSource[]) {
  return sources.flatMap((source) => [
    source.summary,
    ...source.categories,
    ...source.services.flatMap((item) => [item.name, item.description].filter((value): value is string => Boolean(value))),
    ...source.products.flatMap((item) => [item.name, item.description].filter((value): value is string => Boolean(value))),
    ...source.destinations.flatMap((item) => [item.name, item.description].filter((value): value is string => Boolean(value))),
  ]).join("\n");
}

function capabilityFor(key: VisitorActionKey): CapabilityKey | undefined {
  const mapping: Partial<Record<VisitorActionKey, CapabilityKey>> = {
    order: "catalog_order",
    buy: "catalog_order",
    view_products: "catalog_order",
    quote: "quote",
    schedule: "scheduling",
    reserve: "reservation",
    find_location: "routing",
    resale: "qualification",
    recommendation: "qualification",
    support: "qualification",
  };
  return mapping[key];
}

function modeFor(key: VisitorActionKey, hasExternalCatalog: boolean, hasContact: boolean, hasPurposeExternal = false): CommercialArchitecture["journeyBlueprints"][number]["mode"] {
  if (hasPurposeExternal || (key === "view_products" && hasExternalCatalog)) return "direct_external";
  if (["contact", "support"].includes(key) && hasContact) return "direct_contact";
  if (["schedule", "reserve"].includes(key) && hasContact) return "hybrid";
  if (key === "find_location") return "routing";
  if (["order", "buy", "view_products"].includes(key)) return "catalog";
  if (key === "quote") return "quote";
  if (key === "schedule") return "scheduling";
  if (key === "reserve") return "reservation";
  if (["resale", "recommendation", "support"].includes(key)) return "qualification";
  return hasContact ? "direct_contact" : "guided_flow";
}

export function normalizeCommercialArchitecture(input: CommercialArchitecture): CommercialArchitecture {
  const parsed = commercialArchitectureSchema.parse(input);
  const offerings = uniqueBy(parsed.offerings, (item) => normalized(item.name));
  const channels = uniqueBy(parsed.channels, (item) => `${item.type}:${normalized(item.value || item.label)}`);
  const channelIds = new Set(channels.map((item) => item.id));
  const locations = uniqueBy(parsed.locations, (item) => normalized(item.label)).map((location) => ({
    ...location,
    channelIds: [...new Set(location.channelIds.filter((id) => channelIds.has(id)))],
  }));
  const intents = uniqueBy(parsed.intents, (item) => `${item.semanticKey || "custom"}:${normalized(item.label)}`)
    .sort((left, right) => right.priority - left.priority);
  const intentIds = new Set(intents.map((item) => item.id));
  const blueprints = uniqueBy(parsed.journeyBlueprints, (item) => item.intentId)
    .filter((item) => intentIds.has(item.intentId))
    .map((blueprint) => ({
      ...blueprint,
      completion: {
        ...blueprint.completion,
        channelId: blueprint.completion.channelId && channelIds.has(blueprint.completion.channelId)
          ? blueprint.completion.channelId
          : null,
      },
      requiredFacts: uniqueBy(blueprint.requiredFacts, (item) => item.key),
      assumptions: [...new Set(blueprint.assumptions)],
    }));
  const issues = [...new Set(parsed.issues)];
  for (const intent of intents) {
    if (!blueprints.some((blueprint) => blueprint.intentId === intent.id)) {
      issues.push(`O caminho “${intent.label}” ainda não possui uma jornada vinculada.`);
    }
  }
  const blockingFacts = blueprints.flatMap((item) => item.requiredFacts).filter((item) => item.severity === "blocking");
  const confidence = Math.min(parsed.confidence, ...blueprints.map((item) => item.confidence), ...intents.map((item) => item.confidence));
  const status = parsed.status === "degraded"
    ? "degraded"
    : !intents.length || !blueprints.length || confidence < 0.35
    ? "degraded"
    : blockingFacts.length || confidence < 0.7
      ? "needs_confirmation"
      : parsed.status;
  return commercialArchitectureSchema.parse({
    ...parsed,
    status,
    confidence,
    offerings,
    channels,
    locations,
    intents,
    journeyBlueprints: blueprints,
    issues,
  });
}

export function deterministicCommercialArchitecture(input: {
  businessName: string;
  businessDescription: string;
  phone?: string;
  websiteUrl?: string;
  profile: BusinessCapabilityProfile;
  sources?: ExtractedBusinessSource[];
}): CommercialArchitecture {
  const sources = input.sources || [];
  const combined = [input.businessDescription, sourceText(sources)].filter(Boolean).join("\n");
  const userEvidence = evidence("initial-input", "user", input.businessDescription, 1);
  const sourceEvidence = sources.length
    ? evidence("processed-sources", "website", sources.map((source) => source.summary).join(" "), 0.8)
    : userEvidence;
  const detectedLinks = sources.flatMap((source) => source.detectedLinks || []);
  const channels: CommercialArchitecture["channels"] = [];
  if (input.phone) {
    channels.push({ id: "channel-whatsapp-primary", type: "whatsapp", label: "WhatsApp principal", value: input.phone, purpose: "Atendimento principal", isFallback: false, evidence: [userEvidence], confidence: 1 });
  }
  if (input.websiteUrl) {
    const instagram = /instagram\.com/i.test(input.websiteUrl);
    channels.push({ id: "channel-website-primary", type: "external_url", label: instagram ? "Instagram" : "Site principal", value: input.websiteUrl, purpose: instagram ? "Presença pública" : "Site", isFallback: false, evidence: [evidence("initial-input", instagram ? "instagram" : "user", input.websiteUrl, 1)], confidence: 1 });
  }
  for (const [index, link] of detectedLinks.entries()) {
    if (link.classification === "whatsapp") {
      channels.push({ id: stableId("channel-whatsapp", link.label || link.url, index), type: "whatsapp", label: link.label || "WhatsApp", value: phoneFromUrl(link.url) ?? null, purpose: "Atendimento encontrado nos materiais", isFallback: false, evidence: [sourceEvidence], confidence: 0.9 });
    } else if (["menu", "catalog", "delivery", "quote", "commercial_b2b", "scheduling", "location"].includes(link.classification)) {
      channels.push({ id: stableId("channel-link", link.label || link.url, index), type: "external_url", label: link.label || "Link comercial", value: link.url, purpose: link.classification, isFallback: false, evidence: [sourceEvidence], confidence: 0.9 });
    }
  }
  const normalizedChannels = uniqueBy(channels, (item) => `${item.type}:${item.value || normalized(item.label)}`);
  const locations = uniqueBy(sources.flatMap((source) => source.locations), (item) => normalized(item.name || item.description || ""))
    .flatMap((location, index) => location.name || location.description ? [{
      id: stableId("location", location.name || location.description || "", index),
      label: location.name || location.description || `Unidade ${index + 1}`,
      address: location.attributes.find((item) => /endere|address/i.test(item.key))?.value ?? null,
      channelIds: [],
      evidence: [sourceEvidence],
      confidence: 0.75,
    }] : []);
  const offerings = uniqueBy([
    ...sources.flatMap((source) => source.products.map((item) => ({ name: item.name, kind: "product" as const }))),
    ...sources.flatMap((source) => source.services.map((item) => ({ name: item.name, kind: "service" as const }))),
    ...extractExplicitOfferNames(combined).map((name) => ({ name, kind: "other" as const })),
  ].filter((item): item is { name: string; kind: "product" | "service" | "other" } => Boolean(item.name)), (item) => normalized(item.name));
  const explicitKeys = inferDeclaredVisitorActionKeys(combined);
  if (offerings.length >= 2 && /orient|recomend|descobr|identific|entend|escolh.{0,30}(?:opcao|alternativa|produto|servico)/i.test(normalized(combined)) && !explicitKeys.includes("recommendation")) explicitKeys.unshift("recommendation");
  const linkKeys: VisitorActionKey[] = detectedLinks.flatMap((link) => ({
    menu: ["view_products" as const], catalog: ["view_products" as const], delivery: ["order" as const],
    quote: ["quote" as const], commercial_b2b: ["resale" as const], scheduling: ["schedule" as const],
    location: ["find_location" as const], whatsapp: ["contact" as const], site: [], other: [],
  })[link.classification]);
  const inferredKeys = [...new Set([...explicitKeys, ...linkKeys, ...(locations.length > 1 ? ["find_location" as const] : [])])];
  const fallbackOnly = inferredKeys.length === 0;
  const keys = fallbackOnly ? ["contact" as const] : inferredKeys.slice(0, 8);
  const externalCatalog = normalizedChannels.find((channel) => channel.type === "external_url" && /menu|catalog/i.test(channel.purpose || ""));
  const whatsapp = normalizedChannels.find((channel) => channel.type === "whatsapp" && channel.value);
  const externalPurposePatterns: Partial<Record<VisitorActionKey, RegExp>> = {
    view_products: /menu|catalog/,
    order: /delivery/,
    buy: /catalog|delivery/,
    quote: /quote/,
    schedule: /scheduling/,
    reserve: /scheduling/,
    resale: /commercial_b2b/,
    find_location: /location/,
  };
  const externalForIntent = (key: VisitorActionKey) => normalizedChannels.find((channel) => channel.type === "external_url" && externalPurposePatterns[key]?.test(channel.purpose || ""));
  const intents = keys.map((key, index) => ({
    id: stableId("intent", `${key}-${index}`),
    semanticKey: key,
    label: visitorActionDefinition(key)?.label || "Continuar",
    visitorNeed: visitorActionDefinition(key)?.description || "Seguir para o próximo passo.",
    priority: Math.max(10, 100 - index * 10),
    visibleOnEntry: true,
    evidence: [explicitKeys.includes(key) ? userEvidence : sourceEvidence],
    confidence: fallbackOnly ? 0.3 : explicitKeys.includes(key) ? 0.8 : 0.72,
  }));
  const blueprints = intents.map((intent, index): CommercialArchitecture["journeyBlueprints"][number] => {
    const key = intent.semanticKey;
    const purposeExternal = externalForIntent(key);
    const mode = modeFor(key, Boolean(externalCatalog), Boolean(whatsapp), Boolean(purposeExternal));
    const capability = mode === "hybrid" && ["schedule", "reserve"].includes(key) ? undefined : capabilityFor(key);
    const channel = mode === "direct_external" ? purposeExternal || externalCatalog : whatsapp;
    const collects = mode === "hybrid" && key === "reserve"
      ? ["Data de entrada", "Data de saída", "Quantidade de hóspedes"]
      : mode === "hybrid" && key === "schedule"
        ? ["Data preferida", "Horário preferido"]
        : [];
    const requiredFacts: CommercialArchitecture["journeyBlueprints"][number]["requiredFacts"] = [];
    if (mode === "direct_external" && !channel?.value) requiredFacts.push({ key: `architecture.${intent.id}.url`, label: `Link para ${intent.label}`, reason: "O caminho direto precisa de uma URL real.", affects: intent.label, severity: "blocking", resolutionTarget: { type: "external_url", blueprintId: stableId("blueprint", intent.id, index), intentId: intent.id } });
    if (["direct_contact", "qualification", "quote", "hybrid"].includes(mode) && !channel?.value) requiredFacts.push({ key: `architecture.${intent.id}.destination`, label: `Destino de ${intent.label}`, reason: "Precisamos saber qual canal real recebe este contato.", affects: intent.label, severity: "blocking", resolutionTarget: { type: "channel_value", channelId: channel?.id ?? null, intentId: intent.id, channelType: "whatsapp" } });
    if (["scheduling", "reservation"].includes(mode) && !channel?.value) requiredFacts.push({ key: `architecture.${intent.id}.completion`, label: `Conclusão de ${intent.label}`, reason: "Sem agenda nativa confiável, link externo ou canal de atendimento, a Sobe não pode afirmar disponibilidade nem concluir este caminho.", affects: intent.label, severity: "blocking", resolutionTarget: { type: "completion_strategy", blueprintId: stableId("blueprint", intent.id, index), acceptedStrategies: ["fixed", "external_url", "native"] } });
    if (mode === "routing" && (!locations.length || locations.some((location) => !location.channelIds.length))) requiredFacts.push({ key: `architecture.${intent.id}.location_channels`, label: "WhatsApp de cada unidade", reason: "O cliente só pode ser encaminhado quando cada unidade tiver um destino conhecido.", affects: intent.label, severity: "blocking", resolutionTarget: { type: "location_channel_mapping", intentId: intent.id, locationIds: locations.map((location) => location.id), channelType: "whatsapp" } });
    return {
      id: stableId("blueprint", intent.id, index), intentId: intent.id, objective: intent.visitorNeed, mode,
      steps: mode.startsWith("direct_") ? [] : [{ purpose: intent.visitorNeed, expectedCapability: capability ?? null, collects, usesOfferings: offerings.map((item) => stableId("offering", item.name)), usesLocations: locations.map((item) => item.id) }],
      completion: { channelId: channel?.id ?? null, destinationStrategy: mode === "direct_external" ? "external_url" : mode === "routing" ? "by_location" : channel ? "fixed" : "native", handoffSummary: !mode.startsWith("direct_") && Boolean(channel) },
      requiredFacts, assumptions: fallbackOnly ? ["Não foi possível identificar uma intenção comercial específica com segurança."] : [], confidence: intent.confidence,
    };
  });
  const architecture = {
    status: fallbackOnly ? "degraded" as const : blueprints.some((item) => item.requiredFacts.some((fact) => fact.severity === "blocking")) ? "needs_confirmation" as const : "ready" as const,
    confidence: fallbackOnly ? 0.3 : Math.min(...intents.map((item) => item.confidence)),
    businessSummary: { whatItSells: input.businessDescription, commercialModel: input.profile.hasMultipleLocations ? "Operação com múltiplos pontos ou canais de atendimento." : "Operação organizada a partir dos caminhos comerciais informados.", evidence: [userEvidence, ...(sources.length ? [sourceEvidence] : [])] },
    offerings: offerings.map((item, index) => ({ id: stableId("offering", item.name, index), name: item.name, kind: item.kind, evidence: [sourceEvidence], confidence: sources.length ? 0.8 : 0.65 })),
    audienceContexts: [], channels: normalizedChannels, locations, intents, journeyBlueprints: blueprints,
    issues: fallbackOnly ? ["A descrição ainda não sustenta uma arquitetura comercial específica. Reanalise com mais contexto ou fontes."] : [],
  } satisfies CommercialArchitecture;
  return normalizeCommercialArchitecture(architecture);
}

export function visitorActionsFromCommercialArchitecture(architecture: CommercialArchitecture, confirmed = false): VisitorActionSelection[] {
  const normalizedArchitecture = normalizeCommercialArchitecture(architecture);
  const visible = normalizedArchitecture.intents.filter((intent) => intent.visibleOnEntry);
  return (visible.length ? visible : normalizedArchitecture.intents).slice(0, 8).map((intent, index) => {
    const semantic = intent.semanticKey && intent.semanticKey !== "other" ? intent.semanticKey : classifyCustomVisitorAction(intent.label);
    return {
      key: intent.semanticKey || "other",
      label: intent.label,
      isPrimary: index === 0,
      semanticKey: intent.semanticKey && intent.semanticKey !== "other" ? undefined : semantic,
      source: confirmed ? "business_confirmed" : "contextual_ai",
      confidence: confirmed ? 1 : intent.confidence,
      evidence: intent.evidence.flatMap((item) => item.excerpt ? [item.excerpt] : []),
      confirmedByBusiness: confirmed,
    };
  });
}

export function capabilitiesFromCommercialArchitecture(architecture: CommercialArchitecture, fallback: ProjectCapability[] = []) {
  const keys = new Set<CapabilityKey>();
  for (const blueprint of architecture.journeyBlueprints) {
    for (const step of blueprint.steps) if (step.expectedCapability) keys.add(step.expectedCapability);
  }
  return keys.size ? [...keys].map((key) => createCapability(key)) : fallback;
}

export function requirementsFromCommercialArchitecture(architecture: CommercialArchitecture, projectId = "setup"): DataRequirement[] {
  return architecture.journeyBlueprints.flatMap((blueprint) => {
    const capability = blueprint.steps.find((step) => step.expectedCapability)?.expectedCapability || "project";
    return blueprint.requiredFacts.map((fact) => ({
      id: `${projectId}:${fact.key}`,
      key: fact.key,
      label: fact.label,
      capability,
      status: "missing" as const,
      severity: fact.severity,
      reason: `${fact.reason} Isso altera o caminho “${blueprint.objective}”.`,
    }));
  });
}

export function activationUnderstandingFromCommercialArchitecture(architecture: CommercialArchitecture): ActivationUnderstanding {
  const normalizedArchitecture = normalizeCommercialArchitecture(architecture);
  const actions = visitorActionsFromCommercialArchitecture(normalizedArchitecture);
  const primary = actions[0] || { key: "contact" as const, label: "Falar com a equipe", isPrimary: true };
  const primaryIntent = normalizedArchitecture.intents[0];
  const primaryBlueprint = normalizedArchitecture.journeyBlueprints.find((item) => item.intentId === primaryIntent?.id);
  const channel = normalizedArchitecture.channels.find((item) => item.id === primaryBlueprint?.completion.channelId);
  return {
    status: normalizedArchitecture.status,
    source: normalizedArchitecture.status === "degraded" ? "deterministic_fallback" : "contextual_ai",
    declaredObjective: primaryBlueprint?.objective || normalizedArchitecture.businessSummary.whatItSells,
    primaryAction: { key: primary.key, label: primary.label, confidence: primary.confidence || normalizedArchitecture.confidence, evidence: primary.evidence || [], source: normalizedArchitecture.status === "degraded" ? "deterministic_fallback" : "contextual_ai" },
    secondaryActions: actions.slice(1).map((action) => ({ key: action.key, label: action.label, confidence: action.confidence || normalizedArchitecture.confidence, source: normalizedArchitecture.status === "degraded" ? "deterministic_fallback" as const : "contextual_ai" as const })),
    completionAction: { key: channel?.id || "native", label: channel?.label || "Concluir na Sobe", destination: channel?.type || "native", confidence: channel?.confidence || normalizedArchitecture.confidence, source: normalizedArchitecture.status === "degraded" ? "deterministic_fallback" : "contextual_ai" },
    offerings: normalizedArchitecture.offerings.map((offering) => ({ name: offering.name, kind: offering.kind, evidence: offering.evidence[0]?.excerpt || offering.name, confidence: offering.confidence, source: normalizedArchitecture.status === "degraded" ? "deterministic_fallback" as const : "contextual_ai" as const })),
    needsAssistedDiscovery: primaryBlueprint?.mode === "qualification" && normalizedArchitecture.offerings.length >= 2,
    confidence: normalizedArchitecture.confidence,
    issues: normalizedArchitecture.issues,
  };
}

export function commercialArchitectureFromActivationUnderstanding(understanding: ActivationUnderstanding, input: { businessName: string; businessDescription: string; phone?: string; websiteUrl?: string; profile: BusinessCapabilityProfile; sources?: ExtractedBusinessSource[] }) {
  const base = deterministicCommercialArchitecture(input);
  const legacyActions = [understanding.primaryAction, ...understanding.secondaryActions];
  const source = evidence("activation-understanding", "ai_inference", understanding.declaredObjective, understanding.confidence);
  const legacyIntents = legacyActions.map((action, index) => ({ id: stableId("intent", `${action.key}-${index}`), semanticKey: action.key, label: action.label, visitorNeed: index === 0 ? understanding.declaredObjective : visitorActionDefinition(action.key)?.description || action.label, priority: 100 - index * 10, visibleOnEntry: true, evidence: [source], confidence: action.confidence }));
  const useContextualBase = base.status !== "degraded";
  const intents = uniqueBy(useContextualBase ? [...base.intents, ...legacyIntents] : legacyIntents, (intent) => intent.semanticKey || normalized(intent.label));
  const channels = [...base.channels];
  const completionChannel = channels.find((item) => item.type === understanding.completionAction.destination)
    || (understanding.completionAction.destination === "native" ? undefined : { id: "channel-legacy-completion", type: understanding.completionAction.destination, label: understanding.completionAction.label, value: null, purpose: "Destino inferido", isFallback: false, evidence: [source], confidence: understanding.completionAction.confidence });
  if (completionChannel && !channels.some((item) => item.id === completionChannel.id)) channels.push(completionChannel);
  const existingIntentIds = new Set(useContextualBase ? base.intents.map((intent) => intent.id) : []);
  const addedBlueprints = intents.filter((intent) => !existingIntentIds.has(intent.id)).map((intent, index) => {
    const semanticKey = intent.semanticKey || classifyCustomVisitorAction(intent.label);
    const mode = modeFor(semanticKey, Boolean(channels.find((item) => item.type === "external_url" && item.value)), Boolean(channels.find((item) => item.type === "whatsapp" && item.value)));
    const capability = capabilityFor(semanticKey);
    return { id: stableId("blueprint", intent.id, index), intentId: intent.id, objective: intent.visitorNeed, mode, steps: mode.startsWith("direct_") ? [] : [{ purpose: intent.visitorNeed.slice(0, 400), expectedCapability: capability ?? null, collects: [], usesOfferings: understanding.offerings.map((item) => stableId("offering", item.name)), usesLocations: base.locations.map((item) => item.id) }], completion: { channelId: completionChannel?.id ?? null, destinationStrategy: mode === "direct_external" ? "external_url" as const : mode === "routing" ? "by_location" as const : completionChannel ? "fixed" as const : "native" as const, handoffSummary: !mode.startsWith("direct_") }, requiredFacts: [], assumptions: [], confidence: intent.confidence };
  });
  const offerings = uniqueBy([
    ...(useContextualBase && !understanding.offerings.length ? base.offerings : []),
    ...understanding.offerings.map((item, index) => ({ id: stableId("offering", item.name, index), name: item.name, kind: item.kind, evidence: [evidence("activation-understanding", "ai_inference", item.evidence, item.confidence)], confidence: item.confidence })),
  ], (offering) => normalized(offering.name));
  return normalizeCommercialArchitecture({ ...base, status: understanding.status, confidence: Math.min(base.status === "degraded" ? 1 : base.confidence, understanding.confidence), businessSummary: { ...base.businessSummary, whatItSells: input.businessDescription, evidence: [source, ...(useContextualBase ? base.businessSummary.evidence : [])] }, offerings, channels, intents, journeyBlueprints: [...(useContextualBase ? base.journeyBlueprints : []), ...addedBlueprints], issues: [...base.issues.filter(() => useContextualBase), ...understanding.issues] });
}
