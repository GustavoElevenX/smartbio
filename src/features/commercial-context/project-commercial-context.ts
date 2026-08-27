import type { AISetupSession, CommercialArchitecture, CommercialEvidenceRef } from "@/features/ai-setup/ai-setup.schema";
import {
  projectCommercialContextSchema,
  type CommercialContextEvidence,
  type CommercialContextStatus,
  type ProjectCommercialContext,
} from "@/features/commercial-context/project-commercial-context.schema";
import type { Project } from "@/types";

export const PROJECT_COMMERCIAL_CONTEXT_SCHEMA_VERSION = 1;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function evidenceId(value: CommercialEvidenceRef, index: number) {
  const source = normalized(value.sourceId).replace(/[^a-z0-9]+/g, "-").slice(0, 80) || "source";
  return `evidence-${source}-${index + 1}`;
}

function materializeEvidence(architecture: CommercialArchitecture, now: string) {
  const source = [
    ...architecture.businessSummary.evidence,
    ...architecture.audienceContexts.flatMap((item) => item.evidence),
    ...architecture.offerings.flatMap((item) => item.evidence),
    ...architecture.channels.flatMap((item) => item.evidence),
    ...architecture.locations.flatMap((item) => item.evidence),
    ...architecture.intents.flatMap((item) => item.evidence),
  ];
  const seen = new Map<string, CommercialContextEvidence>();
  for (const [index, item] of source.entries()) {
    const key = `${item.sourceId}:${item.origin}:${item.excerpt || ""}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      id: evidenceId(item, index),
      sourceId: item.sourceId,
      origin: item.origin,
      excerpt: item.excerpt,
      confidence: item.confidence,
      observedAt: now,
    });
  }
  return [...seen.values()];
}

function refsFor(evidence: CommercialEvidenceRef[], materialized: CommercialContextEvidence[]) {
  return unique(evidence.flatMap((item) => materialized.filter((candidate) => candidate.sourceId === item.sourceId && candidate.origin === item.origin && candidate.excerpt === item.excerpt).map((candidate) => candidate.id)));
}

function operationalOfferingId(project: Project, architectureId: string, label: string) {
  const candidates = [
    ...(project.commercialConfig?.serviceOfferings || []),
    ...(project.commercialConfig?.catalogItems || []),
    ...(project.commercialConfig?.reservableUnits || []),
  ];
  return candidates.find((item) => item.id === architectureId)?.id
    || candidates.find((item) => normalized(item.name) === normalized(label))?.id
    || null;
}

function operationalDestinationId(project: Project, channel: CommercialArchitecture["channels"][number]) {
  const destinations = project.commercialConfig?.routingDestinations || [];
  return destinations.find((item) => item.id === channel.id)?.id
    || destinations.find((item) => item.value && channel.value && item.value === channel.value)?.id
    || null;
}

function contextStatus(confirmed: boolean): CommercialContextStatus {
  return confirmed ? "confirmed" : "inferred";
}

function mechanismFor(blueprint: CommercialArchitecture["journeyBlueprints"][number], channel: CommercialArchitecture["channels"][number] | undefined) {
  if (blueprint.mode === "direct_external") return channel?.purpose && /catalog|menu/i.test(channel.purpose) ? "external_catalog" as const : "direct_url" as const;
  if (blueprint.mode === "direct_contact") return "direct_whatsapp" as const;
  if (blueprint.mode === "qualification") return "qualification_then_contact" as const;
  if (blueprint.mode === "quote") return "quote_then_contact" as const;
  if (blueprint.mode === "routing") return "routing_then_contact" as const;
  if (blueprint.mode === "scheduling") return "schedule" as const;
  if (blueprint.mode === "reservation") return "reservation" as const;
  if (blueprint.mode === "catalog") return "native_catalog" as const;
  if (blueprint.mode === "hybrid" && channel?.type === "whatsapp") return "guided_whatsapp" as const;
  return "other" as const;
}

function sourceCoverage(session: AISetupSession, architecture: CommercialArchitecture) {
  const websiteUrl = session.initialInput.websiteUrl || "";
  const types = new Set(session.sources.map((source) => source.type));
  return {
    website: types.has("website") || /^https?:\/\//i.test(websiteUrl),
    instagram: /instagram\.com|^@/i.test(websiteUrl),
    linkInBio: /linktr\.ee|beacons\.ai|bio\.site|lnk\.bio|campsite\.bio/i.test(websiteUrl),
    menuOrCatalog: architecture.channels.some((channel) => /menu|catalog|cardap/i.test(`${channel.label} ${channel.purpose || ""}`)),
    documents: [...types].some((type) => ["pdf", "image", "csv", "text"].includes(type)),
    logo: Boolean(session.initialInput.logoReference || session.initialInput.brandIdentity),
  };
}

export function projectCommercialContextFromActivation(input: {
  projectId: string;
  project: Project;
  session: AISetupSession;
  current?: ProjectCommercialContext | null;
  now?: string;
}): ProjectCommercialContext {
  const { projectId, project, session } = input;
  const architecture = session.commercialArchitecture;
  if (!architecture) throw new Error("A sessão não possui arquitetura comercial para materializar.");
  const now = input.now || new Date().toISOString();
  const confirmed = Boolean(session.architectureReviewed);
  const status = contextStatus(confirmed);
  const evidence = materializeEvidence(architecture, now);
  const destinationByChannel = new Map(architecture.channels.map((channel) => [channel.id, operationalDestinationId(project, channel)]));
  const intentBlueprints = new Map(architecture.journeyBlueprints.map((blueprint) => [blueprint.intentId, blueprint]));
  const offeringIds = new Map(architecture.offerings.map((offering) => [offering.id, operationalOfferingId(project, offering.id, offering.name)]));
  const currentRevision = input.current?.revision || 0;

  return projectCommercialContextSchema.parse({
    projectId,
    schemaVersion: PROJECT_COMMERCIAL_CONTEXT_SCHEMA_VERSION,
    revision: currentRevision + 1,
    summary: {
      businessDescription: session.initialInput.description,
      whatItSells: architecture.businessSummary.whatItSells,
      commercialModel: architecture.businessSummary.commercialModel || null,
      valueProposition: null,
    },
    evidence,
    audienceContexts: architecture.audienceContexts.map((audience) => ({
      id: audience.id,
      label: audience.label,
      description: audience.description,
      kind: null,
      status,
      confidence: audience.confidence,
      evidenceRefs: refsFor(audience.evidence, evidence),
    })),
    offeringContexts: architecture.offerings.map((offering) => ({
      id: offering.id,
      offeringId: offeringIds.get(offering.id) || null,
      externalKey: offeringIds.get(offering.id) ? null : offering.id,
      label: offering.name,
      commercialRoles: unique(architecture.intents.filter((intent) => intentBlueprints.get(intent.id)?.steps.some((step) => step.usesOfferings.includes(offering.id))).map((intent) => intent.semanticKey || "commercial_offer")),
      audienceContextIds: [],
      status,
      confidence: offering.confidence,
      evidenceRefs: refsFor(offering.evidence, evidence),
    })),
    intentContexts: architecture.intents.map((intent, index) => ({
      id: intent.id,
      semanticKey: intent.semanticKey,
      label: intent.label,
      visitorNeed: intent.visitorNeed,
      audienceContextIds: [],
      offeringIds: unique((intentBlueprints.get(intent.id)?.steps || []).flatMap((step) => step.usesOfferings).map((id) => offeringIds.get(id) || id)),
      priority: intent.priority,
      entryVisibility: !intent.visibleOnEntry ? "contextual" : index === 0 ? "primary" : "secondary",
      status,
      confidence: intent.confidence,
      evidenceRefs: refsFor(intent.evidence, evidence),
    })),
    channelContexts: architecture.channels.map((channel) => ({
      id: channel.id,
      destinationId: destinationByChannel.get(channel.id) || null,
      externalUrl: channel.type === "external_url" ? channel.value : null,
      role: channel.purpose || channel.label,
      servesIntentIds: architecture.journeyBlueprints.filter((blueprint) => blueprint.completion.channelId === channel.id).map((blueprint) => blueprint.intentId),
      servesAudienceContextIds: [],
      locationIds: architecture.locations.filter((location) => location.channelIds.includes(channel.id)).map((location) => location.id),
      status,
      confidence: channel.confidence,
      evidenceRefs: refsFor(channel.evidence, evidence),
    })),
    locationContexts: architecture.locations.map((location) => ({
      id: `location-context-${location.id}`,
      locationId: project.commercialConfig?.locations?.find((item) => item.id === location.id)?.id || location.id,
      commercialRoles: unique(architecture.journeyBlueprints.filter((blueprint) => blueprint.steps.some((step) => step.usesLocations.includes(location.id))).map((blueprint) => blueprint.mode)),
      destinationIds: unique(location.channelIds.map((channelId) => destinationByChannel.get(channelId) || channelId)),
      servesIntentIds: architecture.journeyBlueprints.filter((blueprint) => blueprint.steps.some((step) => step.usesLocations.includes(location.id))).map((blueprint) => blueprint.intentId),
      status,
      confidence: location.confidence,
      evidenceRefs: refsFor(location.evidence, evidence),
    })),
    purchaseMechanisms: architecture.journeyBlueprints.map((blueprint) => {
      const intent = architecture.intents.find((item) => item.id === blueprint.intentId);
      const channel = architecture.channels.find((item) => item.id === blueprint.completion.channelId);
      const destinationId = channel ? destinationByChannel.get(channel.id) || channel.id : null;
      return {
        id: `mechanism-${blueprint.id}`,
        label: intent?.label || blueprint.objective,
        intentIds: [blueprint.intentId],
        journeyBlueprintId: blueprint.id,
        mechanism: mechanismFor(blueprint, channel),
        requiredInformation: unique([...blueprint.steps.flatMap((step) => step.collects), ...blueprint.requiredFacts.map((fact) => fact.label)]),
        completionStrategy: `${blueprint.completion.type}:${blueprint.completion.destinationStrategy}`,
        destinationIds: destinationId ? [destinationId] : [],
        status,
        confidence: blueprint.confidence,
        evidenceRefs: intent ? refsFor(intent.evidence, evidence) : [],
      };
    }),
    currentArchitecture: {
      architectureRevision: currentRevision + 1,
      materializedProjectVersion: project.version,
      intentIds: architecture.intents.map((intent) => intent.id),
      journeyBlueprintIds: architecture.journeyBlueprints.map((blueprint) => blueprint.id),
      generatedAt: now,
      confirmedAt: confirmed ? now : null,
    },
    assumptions: architecture.journeyBlueprints.flatMap((blueprint) => [
      ...blueprint.assumptions.map((statement, index) => ({ id: `assumption-${blueprint.id}-${index + 1}`, statement, importance: "important" as const, status: "unverified" as const, confidence: blueprint.confidence, evidenceRefs: [] })),
      ...blueprint.requiredFacts.map((fact) => ({ id: `requirement-${blueprint.id}-${fact.key}`, statement: fact.reason, importance: fact.severity === "blocking" ? "blocking" as const : fact.severity === "warning" ? "important" as const : "optional" as const, status: "unverified" as const, confidence: blueprint.confidence, evidenceRefs: [] })),
    ]),
    sourceCoverage: sourceCoverage(session, architecture),
    lastAnalyzedAt: now,
    lastConfirmedAt: confirmed ? now : null,
    updatedAt: now,
  });
}

type MergeMode = "generated" | "user_edit" | "accepted_proposal" | "operational_sync";

function mergeSemantic<T extends { id: string; status: CommercialContextStatus }>(current: T[], incoming: T[], mode: MergeMode) {
  const next = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    const existing = next.get(item.id);
    if (existing?.status === "confirmed" && mode === "generated") continue;
    next.set(item.id, mode === "user_edit" || mode === "accepted_proposal" ? { ...item, status: "confirmed" } : item);
  }
  return [...next.values()];
}

export function mergeProjectCommercialContexts(current: ProjectCommercialContext | null, incoming: ProjectCommercialContext, mode: MergeMode): ProjectCommercialContext {
  if (!current) return projectCommercialContextSchema.parse(incoming);
  const preservesConfirmedSummary = Boolean(current.lastConfirmedAt) && mode === "generated";
  return projectCommercialContextSchema.parse({
    ...incoming,
    projectId: current.projectId,
    schemaVersion: Math.max(current.schemaVersion, incoming.schemaVersion),
    revision: current.revision + 1,
    summary: preservesConfirmedSummary ? current.summary : incoming.summary,
    evidence: [...new Map([...current.evidence, ...incoming.evidence].map((item) => [item.id, item])).values()],
    audienceContexts: mergeSemantic(current.audienceContexts, incoming.audienceContexts, mode),
    offeringContexts: mergeSemantic(current.offeringContexts, incoming.offeringContexts, mode),
    intentContexts: mergeSemantic(current.intentContexts, incoming.intentContexts, mode),
    channelContexts: mergeSemantic(current.channelContexts, incoming.channelContexts, mode),
    locationContexts: mergeSemantic(current.locationContexts, incoming.locationContexts, mode),
    purchaseMechanisms: mergeSemantic(current.purchaseMechanisms, incoming.purchaseMechanisms, mode),
    assumptions: [...new Map([...current.assumptions, ...incoming.assumptions].map((item) => [item.id, item])).values()],
    sourceCoverage: Object.fromEntries(Object.keys(current.sourceCoverage).map((key) => [key, current.sourceCoverage[key as keyof typeof current.sourceCoverage] || incoming.sourceCoverage[key as keyof typeof incoming.sourceCoverage]])),
    lastConfirmedAt: mode === "user_edit" || mode === "accepted_proposal" ? incoming.updatedAt : current.lastConfirmedAt || incoming.lastConfirmedAt,
  });
}

export function reconcileOperationalProjectContext(current: ProjectCommercialContext, project: Project, now = new Date().toISOString()) {
  const destinations = project.commercialConfig?.routingDestinations || [];
  const locations = project.commercialConfig?.locations || [];
  const destinationIds = new Set(destinations.map((item) => item.id));
  const existingLocationIds = new Set(current.locationContexts.map((item) => item.locationId));
  const addedLocations = locations.filter((location) => !existingLocationIds.has(location.id)).map((location) => ({
    id: `location-context-${location.id}`,
    locationId: location.id,
    commercialRoles: unique([location.supportsDelivery ? "delivery" : "", location.supportsPickup ? "pickup" : "", location.supportsInPerson ? "in_person" : ""]),
    destinationIds: location.routingDestinationId ? [location.routingDestinationId] : [],
    servesIntentIds: [],
    status: "inferred" as const,
    confidence: 1,
    evidenceRefs: [],
  }));
  const nextLocations = [...current.locationContexts.map((context) => {
    const location = locations.find((item) => item.id === context.locationId);
    if (!location) return context;
    return { ...context, destinationIds: unique([...context.destinationIds.filter((id) => destinationIds.has(id)), ...(location.routingDestinationId ? [location.routingDestinationId] : [])]) };
  }), ...addedLocations];
  const changedLocationIds = addedLocations.map((item) => item.locationId);
  const affectedIntentIds = unique(current.purchaseMechanisms.filter((mechanism) => mechanism.mechanism === "routing_then_contact" || mechanism.destinationIds.some((id) => !destinationIds.has(id))).flatMap((mechanism) => mechanism.intentIds));
  const context = projectCommercialContextSchema.parse({ ...current, revision: current.revision + 1, locationContexts: nextLocations, updatedAt: now });
  return { context, affectedIntentIds, changedLocationIds };
}

export function commercialContextForAI(context: ProjectCommercialContext) {
  const confirmedFirst = <T extends { status: CommercialContextStatus }>(values: T[]) => values.toSorted((left, right) => Number(right.status === "confirmed") - Number(left.status === "confirmed"));
  return {
    revision: context.revision,
    summary: context.summary,
    audiences: confirmedFirst(context.audienceContexts).map(({ id, label, description, kind, status }) => ({ id, label, description, kind, status })),
    offerings: confirmedFirst(context.offeringContexts).map(({ id, offeringId, label, commercialRoles, audienceContextIds, status }) => ({ id, offeringId, label, commercialRoles, audienceContextIds, status })),
    intents: confirmedFirst(context.intentContexts).map(({ id, semanticKey, label, visitorNeed, priority, entryVisibility, status }) => ({ id, semanticKey, label, visitorNeed, priority, entryVisibility, status })),
    channels: confirmedFirst(context.channelContexts).map(({ id, destinationId, externalUrl, role, servesIntentIds, locationIds, status }) => ({ id, destinationId, externalUrl, role, servesIntentIds, locationIds, status })),
    locations: confirmedFirst(context.locationContexts).map(({ locationId, commercialRoles, destinationIds, servesIntentIds, status }) => ({ locationId, commercialRoles, destinationIds, servesIntentIds, status })),
    purchaseMechanisms: confirmedFirst(context.purchaseMechanisms).map(({ id, intentIds, journeyBlueprintId, mechanism, requiredInformation, completionStrategy, destinationIds, status }) => ({ id, intentIds, journeyBlueprintId, mechanism, requiredInformation, completionStrategy, destinationIds, status })),
    confirmedDecisions: [
      ...context.intentContexts.filter((item) => item.status === "confirmed").map((item) => `Intent confirmado: ${item.label}`),
      ...context.channelContexts.filter((item) => item.status === "confirmed").map((item) => `Canal confirmado: ${item.role}`),
      ...context.purchaseMechanisms.filter((item) => item.status === "confirmed").map((item) => `Mecanismo confirmado: ${item.label} → ${item.completionStrategy}`),
    ],
    relevantEvidence: context.evidence.filter((item) => item.confidence >= 0.8).slice(-20).map(({ sourceId, origin, excerpt, confidence }) => ({ sourceId, origin, excerpt, confidence })),
    pending: context.assumptions.filter((item) => item.status === "unverified" && item.importance !== "optional").map(({ statement, importance }) => ({ statement, importance })),
    precedence: ["latest_user_edit", "confirmed_commercial_context", "current_operational_entity", "recent_trusted_source", "ai_inference"],
  };
}
