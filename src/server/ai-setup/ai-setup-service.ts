import "server-only";

import { randomUUID } from "node:crypto";
import { commercialArchitectureSchema, extractedBusinessSourceSchema, setupDraftInputSchema, setupInitialInputSchema, structuredJourneyQuestionSchema, type AISetupSession, type CommercialArchitecture, type ExtractedBusinessSource, type SetupDraftInput, type SetupInitialInput, type SetupQuestion, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { actionsFromActivationUnderstanding, deterministicActivationUnderstanding, markActionsConfirmed, markOfferingsConfirmed, normalizeActivationUnderstanding, understandingOfferingNames } from "@/features/ai-setup/activation-understanding";
import { activationUnderstandingFromCommercialArchitecture, capabilitiesFromCommercialArchitecture, commercialArchitectureFromActivationUnderstanding, deterministicCommercialArchitecture, normalizeCommercialArchitecture, requirementsFromCommercialArchitecture, visitorActionsFromCommercialArchitecture } from "@/features/ai-setup/commercial-architecture";
import { reconcileCommercialArchitectureRequirements, resolveArchitectureRequirement, validateCommercialArchitectureForMaterialization } from "@/features/ai-setup/architecture-resolution";
import { assertActivationStateInvariants } from "@/features/ai-setup/activation-state-invariants";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { stageGeneratedDraft } from "@/features/ai-setup/stage-generated-draft";
import { normalizeSetupPhone } from "@/features/ai-setup/setup-phone";
import { buildQualificationSuggestions } from "@/features/ai-setup/qualification-proposal";
import { createDiscoveryPlan, discoveryContextSignature, discoveryPlanIsReady } from "@/features/qualification/discovery-plan";
import { offerNamesFromSetup } from "@/features/qualification/offer-context";
import { applyVisitorActionsToProject, classifyCustomVisitorAction, defaultVisitorActions, ensureVisitorActionTargets, profileWithVisitorActions, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { capabilityPlanner } from "@/features/capabilities/capability-planner";
import { draftCapabilityRequirements } from "@/features/capabilities/capability-requirements";
import { CompositionOrchestrator } from "@/features/composition/composition-orchestrator";
import { journeyComposer } from "@/features/composition/journey-composer";
import { visualComposer } from "@/features/composition/visual-composer";
import { slugify } from "@/lib/utils";
import { aiSetupRepository, type AISetupRepository } from "@/server/ai-setup/ai-setup-repository";
import { planAdaptiveQuestions } from "@/server/ai-setup/question-planner";
import type { AISetupActor } from "@/server/auth/setup-actor";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import { sourceRepository } from "@/server/business-sources/source-repository";
import { createWebsiteSource, processWebsiteSource } from "@/server/business-sources/source-service";
import { applyExtractedFacts } from "@/server/business-sources/apply-extracted-facts";
import { reconcileProjectRequirements } from "@/server/business-sources/reconcile-project-requirements";
import { createServiceClient } from "@/lib/supabase/server";
import { activateTrialAfterFirstStructure } from "@/server/entitlements/trial-service";
import { recordPlatformGrowthEvent } from "@/server/platform-acquisition/platform-acquisition";
import { assertProjectAccess } from "@/server/auth/project-access";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { materializeSuggestedSiteStructure } from "@/features/site-composer/materialize-site-structure";
import { suggestedSiteStructureSchema } from "@/features/site-composer/site-composer.schema";
import { suggestSiteStructure } from "@/features/site-composer/site-structure-suggester";
import { inferBusinessShape } from "@/features/site-composer/business-shape";
import { uploadMedia } from "@/server/media/media-service";
import { requireActivationPreflight } from "@/server/ai-setup/activation-preflight";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import { logAISetupLifecycle } from "@/server/ai-setup/ai-setup-observability";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import type { DataRequirement, ExperienceCompositionInput, Project } from "@/types";

function compositionInput(session: AISetupSession): ExperienceCompositionInput {
  const destinationAnswer = Object.entries(session.answers).find(([key]) => key.endsWith(".destination") || key.endsWith(".completion"))?.[1];
  const objective = session.answers["qualification.objective"];
  const destinationText = typeof destinationAnswer === "string" ? destinationAnswer.trim() : "";
  const normalizedDestination = destinationText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const primaryDestination = normalizedDestination.includes("whatsapp")
    ? "WhatsApp"
    : normalizedDestination.includes("email") || normalizedDestination.includes("e-mail")
      ? "E-mail"
      : normalizedDestination.includes("telefone")
        ? "Telefone"
        : destinationText;
  return {
    businessName: session.initialInput.businessName,
    businessDescription: session.initialInput.description,
    primaryGoal: session.visitorActions?.find((action) => action.isPrimary)?.label || (typeof objective === "string" && objective.trim() ? objective : "Criar uma estrutura comercial"),
    primaryDestination: primaryDestination
      ? primaryDestination
      : session.initialInput.phone ? "WhatsApp" : session.initialInput.websiteUrl ? "Site" : "Formulário",
    slug: slugify(session.initialInput.businessName),
    phone: session.initialInput.phone,
    websiteUrl: session.initialInput.websiteUrl,
  };
}

function initialSiteInstruction(project: Project, session: AISetupSession) {
  const actions = (session.visitorActions || []).map((action) => action.label).join(", ");
  const verified = session.missingRequirements
    .filter((requirement) => requirement.status === "verified")
    .map((requirement) => `${requirement.label}: ${String(requirement.value ?? session.answers[requirement.key] ?? "confirmado")}`)
    .join("; ");
  const sources = session.sources.filter((source) => source.status === "processed").map((source) => source.name).join(", ");
  const architecture = session.commercialArchitecture?.journeyBlueprints.map((blueprint) => {
    const intent = session.commercialArchitecture?.intents.find((item) => item.id === blueprint.intentId);
    const channel = session.commercialArchitecture?.channels.find((item) => item.id === blueprint.completion.channelId);
    return `${intent?.label || blueprint.objective} → ${blueprint.mode}${channel ? ` → ${channel.label}` : ""}`;
  }).join("; ");
  return [
    `Crie a primeira página específica de ${project.name}.`,
    project.description,
    project.category ? `Categoria: ${project.category}.` : "",
    actions ? `Ações confirmadas pelo usuário, em ordem de prioridade: ${actions}.` : "",
    architecture ? `Arquitetura comercial confirmada, que não deve ser reinventada pelo design: ${architecture}.` : "",
    verified ? `Informações confirmadas no onboarding: ${verified}.` : "",
    sources ? `Materiais analisados: ${sources}.` : "",
    "Mostre múltiplas ações legítimas quando existirem, conecte apenas goals reais e não invente fatos, preços, provas ou números.",
  ].filter(Boolean).join(" ");
}

function resolvedRequirements(requirements: DataRequirement[], answers: Record<string, unknown>) {
  return requirements.map((requirement): DataRequirement => answers[requirement.key] == null || requirement.key.startsWith("architecture.") ? requirement : {
    ...requirement,
    status: "verified",
    value: answers[requirement.key],
    origin: "user",
    sourceId: "adaptive-onboarding",
    reason: "Informação confirmada durante o onboarding adaptativo.",
  });
}

function requirementsForActions(
  requirements: DataRequirement[],
  actions: VisitorActionSelection[],
  projectId = "setup",
  discoveryPlan?: AISetupSession["discoveryPlan"],
) {
  const primary = actions.find((action) => action.isPrimary) || actions[0];
  const recommends = primary && (primary.key === "recommendation" || primary.semanticKey === "recommendation");
  const withoutOrphanQuestions = discoveryPlan
    ? requirements
    : requirements.filter((item) => item.key !== "qualification.questions");
  if (!recommends) return withoutOrphanQuestions;
  if (withoutOrphanQuestions.some((item) => item.key === "qualification.offerings")) return withoutOrphanQuestions;
  const questionsIndex = withoutOrphanQuestions.findIndex((item) => item.key === "qualification.questions");
  const objectiveIndex = withoutOrphanQuestions.findIndex((item) => item.key === "qualification.objective");
  const offering: DataRequirement = {
    id: `${projectId}:qualification.offerings`,
    key: "qualification.offerings",
    label: "Opções da recomendação",
    capability: "qualification",
    status: "missing",
    severity: "blocking",
    reason: "Quais opções reais podem aparecer no resultado?",
  };
  const next = [...withoutOrphanQuestions];
  next.splice(questionsIndex >= 0 ? questionsIndex : objectiveIndex >= 0 ? objectiveIndex + 1 : next.length, 0, offering);
  return next;
}

function plannedQuestions(
  session: AISetupSession,
  requirements: DataRequirement[],
  providerQuestions?: SetupQuestion[],
) {
  const suggestions = buildQualificationSuggestions(session);
  const structured = session.discoveryPlan
    ? { "qualification.questions": session.discoveryPlan.questions }
    : {};
  const planningRequirements = session.discoveryPlan
    ? requirements
    : requirements.filter((requirement) => requirement.key !== "qualification.questions");
  const planned = planAdaptiveQuestions(planningRequirements, session.answers, 3, suggestions, structured, session.commercialArchitecture);
  if (!providerQuestions?.length) return planned;
  const providerByKey = new Map(providerQuestions.map((question) => [question.key, question]));
  return planned.map((question) => {
    const provider = providerByKey.get(question.key);
    if (!provider || question.suggestedAnswer) return question;
    return { ...provider, id: question.id, priority: question.priority };
  });
}

function recommendationSelected(session: AISetupSession) {
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  return Boolean(primary && (primary.key === "recommendation" || primary.semanticKey === "recommendation"));
}

async function composePersistedDiscoveryPlan(
  actor: AISetupActor,
  session: AISetupSession,
  answers: Record<string, unknown>,
) {
  if (!(session.architectureReviewed || session.actionsConfirmed) || !recommendationSelected(session)) return undefined;
  const architecture = session.commercialArchitecture;
  if (!architecture && (answers["qualification.objective"] == null || answers["qualification.offerings"] == null)) return undefined;
  const contextualNames = architecture?.offerings.map((item) => item.name) || understandingOfferingNames(session.activationUnderstanding);
  const offeringNames = contextualNames.length
    ? contextualNames
    : offerNamesFromSetup(session.initialInput.description, answers["qualification.offerings"]);
  if (offeringNames.length < 2) return undefined;
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const primaryIntent = architecture?.intents.find((item) => item.semanticKey === primary?.key) || architecture?.intents[0];
  const primaryBlueprint = architecture?.journeyBlueprints.find((item) => item.intentId === primaryIntent?.id);
  const channel = architecture?.channels.find((item) => item.id === primaryBlueprint?.completion.channelId);
  const declaredObjective = String(answers["qualification.objective"] || primaryBlueprint?.objective || primary?.label || "Orientar o visitante").trim();
  const destination = String(answers["qualification.destination"] || channel?.label || (session.initialInput.phone ? "WhatsApp" : "Atendimento da equipe")).trim();
  const signature = discoveryContextSignature({
    businessName: session.initialInput.businessName,
    businessDescription: session.initialInput.description,
    declaredObjective,
    destination,
    offeringNames,
  });
  if (session.discoveryPlan?.contextSignature === signature && session.discoveryPlan.status !== "invalidated") return session.discoveryPlan;
  const planningInput = {
    businessName: session.initialInput.businessName,
    businessDescription: session.initialInput.description,
    declaredObjective,
    primaryAction: { key: primary?.key || "recommendation", label: primary?.label || declaredObjective },
    completionAction: { label: "Conversar com a equipe", destination },
    offeringNames,
    workspaceId: actor.workspaceId,
    setupSessionId: session.id,
    userId: actor.userId,
  };
  try {
    const draft = isAIConfigured() ? await getAIProvider().composeDiscoveryPlan(planningInput) : undefined;
    return createDiscoveryPlan({ ...planningInput, draft, providerFailed: !draft });
  } catch {
    return createDiscoveryPlan({ ...planningInput, providerFailed: true });
  }
}

export async function reconcileActivationState(
  actor: AISetupActor,
  session: AISetupSession,
  providerQuestions?: SetupQuestion[],
) {
  if (session.commercialArchitecture) {
    session = { ...session, commercialArchitecture: reconcileCommercialArchitectureRequirements(session.commercialArchitecture) };
  }
  const baseProfile = session.extractedProfile || new RuleBasedBusinessAnalyzer().analyze(compositionInput(session));
  const selectedActions = session.visitorActions.length
    ? session.visitorActions
    : session.commercialArchitecture
      ? visitorActionsFromCommercialArchitecture(session.commercialArchitecture, Boolean(session.architectureReviewed))
    : session.activationUnderstanding
      ? actionsFromActivationUnderstanding(session.activationUnderstanding)
      : defaultVisitorActions(baseProfile, session.initialInput.description);
  const profile = profileWithVisitorActions(baseProfile, selectedActions);
  let answers = { ...session.answers };
  if (session.commercialArchitecture && recommendationSelected({ ...session, visitorActions: selectedActions })) {
    const primary = selectedActions.find((action) => action.isPrimary) || selectedActions[0];
    const intent = session.commercialArchitecture.intents.find((item) => item.semanticKey === primary?.key) || session.commercialArchitecture.intents[0];
    const blueprint = session.commercialArchitecture.journeyBlueprints.find((item) => item.intentId === intent?.id);
    answers["qualification.objective"] ??= blueprint?.objective;
    answers["qualification.offerings"] ??= session.commercialArchitecture.offerings.map((item) => item.name).join("\n");
    const channel = session.commercialArchitecture.channels.find((item) => item.id === blueprint?.completion.channelId);
    answers["qualification.destination"] ??= channel?.label;
  }
  const discoveryPlan = await composePersistedDiscoveryPlan(actor, {
    ...session,
    extractedProfile: profile,
    visitorActions: selectedActions,
    answers,
  }, answers);

  if (session.discoveryPlan && discoveryPlan && session.discoveryPlan.id !== discoveryPlan.id) {
    const { ["qualification.questions"]: _discardedQuestions, ...answersWithoutStaleQuestions } = answers;
    void _discardedQuestions;
    answers = answersWithoutStaleQuestions;
  }

  if (session.commercialArchitecture && discoveryPlan && discoveryPlanIsReady(discoveryPlan)) {
    answers["qualification.questions"] ??= discoveryPlan.questions;
  }

  const legacyCapabilities = capabilityPlanner.planForVisitorActions(profile, selectedActions);
  const capabilities = session.commercialArchitecture
    ? capabilitiesFromCommercialArchitecture(session.commercialArchitecture, legacyCapabilities)
    : legacyCapabilities;
  const requirements = resolvedRequirements(
    session.commercialArchitecture
      ? requirementsFromCommercialArchitecture(session.commercialArchitecture, session.id)
      : requirementsForActions(draftCapabilityRequirements(capabilities), selectedActions, session.id, discoveryPlan),
    answers,
  );
  const validKeys = new Set(requirements.filter((item) => item.status !== "verified").map((item) => item.key));
  const validProviderQuestions = providerQuestions?.filter((item) => validKeys.has(item.key)).slice(0, 3);
  const reconciled = {
    ...session,
    extractedProfile: profile,
    visitorActions: selectedActions,
    answers,
    discoveryPlan,
    missingRequirements: requirements,
    usedFallback: session.usedFallback
      || session.activationUnderstanding?.status === "degraded"
      || discoveryPlan?.status === "degraded",
  } satisfies AISetupSession;
  return assertActivationStateInvariants({
    ...reconciled,
    questions: plannedQuestions(reconciled, requirements, validProviderQuestions),
  } satisfies AISetupSession);
}

function scalarFactValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function sourceReference(input: { id: string; name: string; type: string; status: string; processingError?: string }): SourceReference {
  return {
    id: input.id,
    name: input.name,
    type: input.type === "website" ? "website" : input.type === "pdf" ? "pdf" : input.type === "image" ? "image" : input.type === "csv" ? "csv" : "text",
    status: ["pending", "uploaded", "processing", "processed", "failed"].includes(input.status)
      ? input.status as SourceReference["status"]
      : "failed",
    processingError: input.processingError,
  };
}

async function enrichPrimaryWebsite(actor: AISetupActor, session: AISetupSession) {
  if (actor.persistence !== "database" || !session.initialInput.websiteUrl) return session;
  const hostname = new URL(session.initialInput.websiteUrl).hostname;
  if (session.sources.some((item) => item.type === "website" && item.name === hostname)) return session;
  const created = await createWebsiteSource(actor, { url: session.initialInput.websiteUrl, setupSessionId: session.id });
  let reference = sourceReference(created);
  try {
    const processed = await processWebsiteSource(actor, created.id);
    reference = sourceReference(processed.source);
  } catch {
    const failed = await sourceRepository.get(actor, created.id);
    if (failed) reference = sourceReference(failed);
  }
  return { ...session, sources: [...session.sources, reference].slice(0, 10) } satisfies AISetupSession;
}

function mergeProjectRequirements(project: Project, session: AISetupSession) {
  const byKey = new Map(session.missingRequirements.map((item) => [item.key, item]));
  return (project.dataRequirements || []).map((item) => byKey.get(item.key) || item);
}

function applyBrandIdentity(project: Project, session: AISetupSession): Project {
  const identity = session.initialInput.brandIdentity;
  if (!identity) return project;
  return {
    ...project,
    visualDirection: identity.visualDirection,
    brand: {
      ...project.brand,
      extractedColors: identity.extractedColors,
      activePalette: identity.activePalette,
      paletteVariations: identity.paletteVariations,
      brandPersonality: identity.brandPersonality,
      analysisMetadata: {
        confidence: identity.analysisMetadata.confidence,
        orientation: identity.analysisMetadata.orientation,
        luminance: identity.analysisMetadata.luminance,
        colorCount: identity.analysisMetadata.colorCount,
      },
    },
    designSystem: {
      ...project.designSystem,
      colors: identity.activePalette,
      spacing: { ...project.designSystem.spacing, density: identity.density },
      typography: {
        ...project.designSystem.typography,
        scale: identity.brandPersonality.some((item) => item.toLowerCase().includes("vibr")) ? "expressive" : project.designSystem.typography.scale,
      },
    },
  };
}

async function materializeBrandLogo(actor: AISetupActor, session: AISetupSession, projectId: string) {
  const identity = session.initialInput.brandIdentity;
  if (!identity || actor.persistence !== "database") return;
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  const { data: current } = await database.from("brand_profiles").select("primary_logo_asset_id").eq("project_id", projectId).maybeSingle();
  if (current?.primary_logo_asset_id) return;
  const source = await sourceRepository.get(actor, identity.sourceId);
  if (!source?.storagePath || !source.mimeType) throw new Error("A logo analisada não está mais disponível.");
  const { data: stored, error: downloadError } = await database.storage.from("business-sources").download(source.storagePath);
  if (downloadError || !stored) throw new Error("Não foi possível recuperar a logo analisada.");
  const logo = new File([await stored.arrayBuffer()], source.name, { type: source.mimeType });
  const asset = await uploadMedia(actor, projectId, logo, { assetType: "logo", altText: `Logo de ${session.initialInput.businessName}`, tags: ["marca", "logo-principal"] });
  const { error: brandError } = await database.from("brand_profiles").update({ primary_logo_asset_id: asset.id }).eq("project_id", projectId);
  if (brandError) throw new Error("A logo foi enviada, mas não pôde ser vinculada à marca.");
  const { data: projectRow } = await database.from("projects").select("settings").eq("id", projectId).single();
  const settings = projectRow?.settings && typeof projectRow.settings === "object" ? projectRow.settings as Record<string, unknown> : {};
  const payload = settings.projectPayload && typeof settings.projectPayload === "object" ? settings.projectPayload as Project : undefined;
  if (payload) {
    await database.from("projects").update({ settings: { ...settings, projectPayload: { ...payload, brand: { ...payload.brand, primaryLogoAssetId: asset.id } } } }).eq("id", projectId);
  }
}

export class AISetupService {
  constructor(private readonly repository: AISetupRepository = aiSetupRepository) {}

  async initialize(
    actor: AISetupActor,
    idempotencyKey: string,
    reason: "new" | "recovered" | "restarted" = "new",
  ) {
    await requireActivationPreflight(actor);
    const existing = await this.repository.get(actor, idempotencyKey);
    if (existing) {
      logAISetupLifecycle(
        "onboarding_session_resumed",
        actor,
        existing.id,
        { status: existing.status },
      );
      return existing;
    }
    const now = new Date().toISOString();
    const created = await this.repository.createIdempotent(actor, {
      id: idempotencyKey,
      workspaceId: actor.workspaceId,
      status: "collecting",
      initialInput: { businessName: "", description: "" },
      architectureReviewed: false,
      architectureEdited: false,
      visitorActions: [],
      actionsConfirmed: false,
      answers: {},
      missingRequirements: [],
      questions: [],
      sources: [],
      usedFallback: false,
      createdAt: now,
      updatedAt: now,
    });
    logAISetupLifecycle(
      reason === "recovered"
        ? "onboarding_session_recovered"
        : reason === "restarted"
          ? "onboarding_session_restarted"
          : "onboarding_session_created",
      actor,
      created.id,
      { status: created.status },
    );
    return created;
  }

  async active(actor: AISetupActor) {
    const session = await this.repository.latestActive(actor);
    if (session)
      logAISetupLifecycle(
        "onboarding_session_resumed",
        actor,
        session.id,
        { status: session.status },
      );
    return session;
  }

  async start(actor: AISetupActor, initialInput: SetupInitialInput, sources: SourceReference[] = []) {
    await requireActivationPreflight(actor);
    const now = new Date().toISOString();
    const normalizedInput = {
      ...initialInput,
      phone: normalizeSetupPhone(initialInput.phone),
    };
    const session: AISetupSession = {
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      status: "collecting",
      initialInput: normalizedInput,
      architectureReviewed: false,
      architectureEdited: false,
      visitorActions: [],
      actionsConfirmed: false,
      answers: {},
      missingRequirements: [],
      questions: [],
      sources,
      usedFallback: false,
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.repository.create(actor, session);
    if (actor.persistence === "database") {
      const sourceIds = [...sources.map((source) => source.id), ...(normalizedInput.brandIdentity?.sourceId ? [normalizedInput.brandIdentity.sourceId] : [])];
      await sourceRepository.attachToSession(actor, sourceIds, created.id);
    }
    await this.repository.addMessage(actor, created.id, "user", normalizedInput.description, { kind: "business_description" });
    return created;
  }

  async get(actor: AISetupActor, id: string) {
    const session = await this.repository.get(actor, id);
    if (!session) {
      logAISetupLifecycle("onboarding_session_invalid", actor, id, {
        code: "not_found_or_actor_mismatch",
      });
      throw new AISetupNotFoundError("Sessão de onboarding não encontrada.");
    }
    return session;
  }

  async saveDraft(actor: AISetupActor, id: string, input: SetupDraftInput) {
    const session = await this.get(actor, id);
    const draft = setupDraftInputSchema.parse(input);
    return this.repository.update(actor, {
      ...session,
      status: "collecting",
      initialInput: draft,
      discoveryPlan: session.discoveryPlan ? { ...session.discoveryPlan, status: "invalidated" } : undefined,
      lastError: undefined,
    });
  }

  async analyze(
    actor: AISetupActor,
    id: string,
    revision?: { initialInput?: SetupInitialInput; sources?: SourceReference[] },
  ) {
    let session = await this.get(actor, id);
    if (revision?.initialInput) {
      const revisedSources = revision.sources ?? session.sources;
      const revisedInput = {
        ...revision.initialInput,
        phone: normalizeSetupPhone(revision.initialInput.phone),
      };
      session = await this.repository.update(actor, {
        ...session,
        projectId: undefined,
        status: "analyzing",
        initialInput: revisedInput,
        extractedProfile: undefined,
        activationUnderstanding: undefined,
        commercialArchitecture: undefined,
        architectureReviewed: false,
        architectureEdited: false,
        visitorActions: [],
        actionsConfirmed: false,
        answers: {},
        missingRequirements: [],
        questions: [],
        sources: revisedSources,
        projectDraft: undefined,
        discoveryPlan: undefined,
        lastError: undefined,
        usedFallback: false,
      });
      if (actor.persistence === "database") {
        const sourceIds = [
          ...revisedSources.map((source) => source.id),
          ...(revisedInput.brandIdentity?.sourceId ? [revisedInput.brandIdentity.sourceId] : []),
        ];
        await sourceRepository.attachToSession(actor, sourceIds, session.id);
      }
      await this.repository.addMessage(actor, id, "user", revisedInput.description, { kind: "business_description_revision" });
    } else {
      session = await this.repository.update(actor, { ...session, status: "analyzing", lastError: undefined });
    }
    setupInitialInputSchema.parse(session.initialInput);
    let sourceEnrichmentFailed = false;
    try {
      const enriched = await enrichPrimaryWebsite(actor, session);
      if (enriched.sources.length !== session.sources.length) session = await this.repository.update(actor, enriched);
    } catch {
      // Instagram and public sites are best-effort. Other sources and explicit facts remain usable.
      sourceEnrichmentFailed = true;
    }
    const input = compositionInput(session);
    const fallbackProfile = new RuleBasedBusinessAnalyzer().analyze(input);
    let profile = fallbackProfile;
    let commercialArchitecture: CommercialArchitecture;
    let activationUnderstanding = deterministicActivationUnderstanding({ profile: fallbackProfile, businessDescription: session.initialInput.description, phone: session.initialInput.phone, websiteUrl: session.initialInput.websiteUrl });
    let providerQuestions: SetupQuestion[] | undefined;
    let usedFallback = !isAIConfigured() || sourceEnrichmentFailed;
    let contextualArchitectureProduced = false;

    const sourceData: ExtractedBusinessSource[] = [];
    if (actor.persistence === "database") {
      for (const reference of session.sources.filter((source) => source.status === "processed")) {
        const source = await sourceRepository.get(actor, reference.id);
        if (!source) continue;
        const parsed = extractedBusinessSourceSchema.safeParse(source.extractedData);
        if (!parsed.success) continue;
        const reviewed = await sourceRepository.listFacts(actor, source.id);
        sourceData.push({ ...parsed.data, facts: reviewed.filter((fact) => fact.verificationStatus !== "rejected").map((fact) => ({ key: fact.key, value: scalarFactValue(fact.value), origin: source.type === "website" ? "website" as const : "document" as const, sourceId: source.id, evidenceExcerpt: fact.evidenceExcerpt ?? null, confidence: fact.confidence || 0, verificationStatus: fact.verificationStatus === "verified" ? "verified" as const : fact.verificationStatus === "invalid" ? "invalid" as const : "needs_confirmation" as const })) });
      }
    }

    commercialArchitecture = deterministicCommercialArchitecture({
      businessName: session.initialInput.businessName,
      businessDescription: session.initialInput.description,
      phone: session.initialInput.phone,
      websiteUrl: session.initialInput.websiteUrl,
      profile,
      sources: sourceData,
    });
    activationUnderstanding = activationUnderstandingFromCommercialArchitecture(commercialArchitecture);

    if (isAIConfigured()) {
      try {
        const analysisInput = {
          input,
          sources: sourceData,
          workspaceId: actor.workspaceId,
          setupSessionId: id,
          userId: actor.userId,
        };
        const provider = getAIProvider();
        const architecturePromise = provider.analyzeCommercialArchitecture
          ? provider.analyzeCommercialArchitecture(analysisInput)
          : provider.analyzeActivationUnderstanding(analysisInput).then((understanding) => commercialArchitectureFromActivationUnderstanding(understanding, {
              businessName: session.initialInput.businessName,
              businessDescription: session.initialInput.description,
              phone: session.initialInput.phone,
              websiteUrl: session.initialInput.websiteUrl,
              profile,
              sources: sourceData,
            }));
        const [businessResult, architectureResult] = await Promise.allSettled([
          provider.analyzeBusiness(analysisInput),
          architecturePromise,
        ]);
        if (businessResult.status === "fulfilled") profile = businessResult.value.profile;
        else usedFallback = true;
        if (architectureResult.status === "fulfilled") {
          commercialArchitecture = normalizeCommercialArchitecture(architectureResult.value);
          activationUnderstanding = normalizeActivationUnderstanding(activationUnderstandingFromCommercialArchitecture(commercialArchitecture));
          contextualArchitectureProduced = true;
        } else {
          usedFallback = true;
        }
      } catch {
        usedFallback = true;
      }
    }

    if (!contextualArchitectureProduced) {
      commercialArchitecture = normalizeCommercialArchitecture({ ...commercialArchitecture, status: "degraded", issues: [...commercialArchitecture.issues, "A análise contextual não ficou disponível. Seus fatos e fontes foram preservados para uma nova tentativa."] });
      activationUnderstanding = normalizeActivationUnderstanding(activationUnderstandingFromCommercialArchitecture(commercialArchitecture));
    }

    const proposedActions = visitorActionsFromCommercialArchitecture(commercialArchitecture);
    const provisional = await reconcileActivationState(actor, {
      ...session,
      extractedProfile: profile,
      activationUnderstanding,
      commercialArchitecture,
      architectureReviewed: false,
      architectureEdited: false,
      visitorActions: proposedActions,
      actionsConfirmed: false,
      usedFallback: usedFallback || activationUnderstanding.status === "degraded",
    });
    if (isAIConfigured() && !usedFallback) {
      try {
        providerQuestions = await getAIProvider().generateMissingQuestions({
          profile,
          requirements: provisional.missingRequirements,
          answers: provisional.answers,
          workspaceId: actor.workspaceId,
          setupSessionId: id,
          userId: actor.userId,
        });
      } catch {
        usedFallback = true;
      }
    }
    const reconciled = await reconcileActivationState(actor, {
      ...provisional,
      usedFallback: usedFallback || provisional.usedFallback,
    }, providerQuestions);
    const next = await this.repository.update(actor, {
      ...reconciled,
      status: "waiting_answers",
    });
    if (actor.persistence === "database") {
      const database = createServiceClient();
      if (database) await recordPlatformGrowthEvent(database, {
        eventName: revision ? "commercial_architecture_regenerated" : "commercial_architecture_generated",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        metadata: { numberOfSources: session.sources.length, numberOfIntents: commercialArchitecture.intents.length, numberOfJourneyBlueprints: commercialArchitecture.journeyBlueprints.length, numberOfBlockingQuestions: commercialArchitecture.journeyBlueprints.flatMap((item) => item.requiredFacts).filter((item) => item.severity === "blocking").length, architectureConfidence: commercialArchitecture.confidence, usedFallback, sourceCoverage: [...new Set(session.sources.map((item) => item.type))] },
        idempotencyKey: `${revision ? "commercial_architecture_regenerated" : "commercial_architecture_generated"}:${id}:${next.updatedAt}`,
      }).catch(() => undefined);
    }
    await this.repository.addMessage(actor, id, "assistant", "Estudei os fatos e as fontes e montei uma arquitetura comercial completa para você revisar.", { kind: "commercial_architecture", usedFallback, numberOfIntents: commercialArchitecture.intents.length, numberOfJourneyBlueprints: commercialArchitecture.journeyBlueprints.length, numberOfBlockingQuestions: commercialArchitecture.journeyBlueprints.flatMap((item) => item.requiredFacts).filter((item) => item.severity === "blocking").length, architectureConfidence: commercialArchitecture.confidence });
    return next;
  }

  async confirmVisitorActions(actor: AISetupActor, id: string, actions: VisitorActionSelection[]) {
    const session = await this.get(actor, id);
    if (!session.extractedProfile) throw new Error("Analise o negócio antes de confirmar as ações.");
    if (!session.activationUnderstanding) throw new Error("A análise não produziu um entendimento de Activation confirmável.");
    if (!actions.length) throw new Error("Escolha ao menos uma ação para o visitante.");
    if (actions.filter((action) => action.isPrimary).length !== 1) throw new Error("Marque uma única ação como principal.");
    const provider = isAIConfigured() ? getAIProvider() : undefined;
    const classifiedActions = await Promise.all(actions.map(async (action): Promise<VisitorActionSelection> => {
      if (action.key !== "other") return { ...action, semanticKey: undefined };
      let semanticKey = classifyCustomVisitorAction(action.label);
      if (provider?.classifyVisitorAction) {
        try {
          const result = await provider.classifyVisitorAction({
            actionLabel: action.label,
            businessName: session.initialInput.businessName,
            businessDescription: session.initialInput.description,
            profile: session.extractedProfile!,
            workspaceId: actor.workspaceId,
            setupSessionId: id,
            userId: actor.userId,
          });
          semanticKey = result.key;
        } catch {
          // A classificação local mantém o fluxo disponível se a IA falhar.
        }
      }
      return { ...action, semanticKey };
    }));
    const confirmation = markActionsConfirmed(session.activationUnderstanding, classifiedActions);
    const legacyAnswers = { ...session.answers };
    if (session.commercialArchitecture) {
      delete legacyAnswers["qualification.objective"];
      delete legacyAnswers["qualification.offerings"];
      delete legacyAnswers["qualification.destination"];
      delete legacyAnswers["qualification.questions"];
    }
    const reconciled = await reconcileActivationState(actor, {
      ...session,
      activationUnderstanding: confirmation.understanding,
      commercialArchitecture: undefined,
      visitorActions: confirmation.actions,
      actionsConfirmed: true,
      architectureReviewed: false,
      architectureEdited: Boolean(session.commercialArchitecture),
      discoveryPlan: undefined,
      answers: legacyAnswers,
      status: "waiting_answers",
    });
    const next = await this.repository.update(actor, {
      ...reconciled,
    });
    await this.repository.addMessage(actor, id, "user", confirmation.actions.map((action) => action.label).join(", "), { kind: "visitor_actions", source: confirmation.understanding.source });
    return next;
  }

  async confirmCommercialArchitecture(actor: AISetupActor, id: string) {
    const session = await this.get(actor, id);
    if (!session.extractedProfile || !session.commercialArchitecture) throw new Error("Analise o negócio antes de confirmar a interpretação.");
    if (session.commercialArchitecture.status === "degraded") throw new Error("A interpretação ainda não tem segurança suficiente. Tente analisar novamente com mais contexto.");
    const actions = visitorActionsFromCommercialArchitecture(session.commercialArchitecture, true);
    const reconciled = await reconcileActivationState(actor, {
      ...session,
      architectureReviewed: true,
      visitorActions: actions,
      actionsConfirmed: true,
      status: "waiting_answers",
      discoveryPlan: undefined,
    });
    const next = await this.repository.update(actor, reconciled);
    if (actor.persistence === "database") {
      const database = createServiceClient();
      if (database) await recordPlatformGrowthEvent(database, { eventName: "commercial_architecture_confirmed", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { numberOfIntents: actions.length, architectureConfidence: session.commercialArchitecture.confidence, userEditedArchitecture: false }, idempotencyKey: `commercial_architecture_confirmed:${id}` }).catch(() => undefined);
    }
    await this.repository.addMessage(actor, id, "user", "A interpretação comercial está correta.", { kind: "commercial_architecture_confirmed", numberOfIntents: actions.length });
    return next;
  }

  async updateCommercialArchitecture(actor: AISetupActor, id: string, input: CommercialArchitecture) {
    const session = await this.get(actor, id);
    if (!session.extractedProfile || !session.commercialArchitecture) throw new Error("Analise o negócio antes de ajustar a interpretação.");
    const architecture = normalizeCommercialArchitecture(commercialArchitectureSchema.parse(input));
    if (architecture.status === "degraded") throw new Error("O ajuste precisa manter ao menos um caminho comercial completo.");
    const actions = visitorActionsFromCommercialArchitecture(architecture, true);
    const reconciled = await reconcileActivationState(actor, {
      ...session,
      commercialArchitecture: architecture,
      activationUnderstanding: normalizeActivationUnderstanding(activationUnderstandingFromCommercialArchitecture(architecture)),
      architectureReviewed: true,
      architectureEdited: true,
      visitorActions: actions,
      actionsConfirmed: true,
      status: "waiting_answers",
      discoveryPlan: undefined,
    });
    const next = await this.repository.update(actor, reconciled);
    if (actor.persistence === "database") {
      const database = createServiceClient();
      if (database) await recordPlatformGrowthEvent(database, { eventName: "commercial_architecture_edited", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { numberOfIntents: actions.length, architectureConfidence: architecture.confidence, userEditedArchitecture: true }, idempotencyKey: `commercial_architecture_edited:${id}:${next.updatedAt}` }).catch(() => undefined);
    }
    await this.repository.addMessage(actor, id, "user", "Ajustei a interpretação comercial sugerida.", { kind: "commercial_architecture_edited", numberOfIntents: actions.length });
    return next;
  }

  async answer(actor: AISetupActor, id: string, key: string, value: unknown) {
    const session = await this.get(actor, id);
    const requirement = session.missingRequirements.find((item) => item.key === key);
    if (!requirement) throw new Error("Essa pergunta não pertence à sessão atual.");
    let activationUnderstanding = session.activationUnderstanding;
    let commercialArchitecture = session.commercialArchitecture;
    if (commercialArchitecture && key.startsWith("architecture.")) {
      const fact = commercialArchitecture.journeyBlueprints.flatMap((blueprint) => blueprint.requiredFacts).find((item) => item.key === key);
      if (!fact) throw new Error("Esse blocker não possui um target estrutural ativo.");
      const result = resolveArchitectureRequirement({ architecture: commercialArchitecture, requirement: fact, answer: value, sourceId: session.id });
      const changed = JSON.stringify(result.architecture) !== JSON.stringify(commercialArchitecture);
      if (!result.resolved && !changed) throw new Error(result.warnings[0] || "A resposta não resolveu a configuração necessária.");
      commercialArchitecture = result.architecture;
      activationUnderstanding = normalizeActivationUnderstanding(activationUnderstandingFromCommercialArchitecture(commercialArchitecture));
    }
    if (activationUnderstanding && key === "qualification.offerings") {
      const confirmedOfferings = offerNamesFromSetup("", value);
      if (confirmedOfferings.length < 2) throw new Error("Confirme pelo menos duas opções reais para montar a recomendação.");
      activationUnderstanding = markOfferingsConfirmed(
        activationUnderstanding,
        confirmedOfferings,
      );
    }
    if (activationUnderstanding && key === "qualification.objective" && typeof value === "string" && value.trim()) {
      activationUnderstanding = normalizeActivationUnderstanding({
        ...activationUnderstanding,
        declaredObjective: value.trim(),
      });
    }
    if (activationUnderstanding && key === "qualification.destination" && typeof value === "string" && value.trim()) {
      const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      activationUnderstanding = normalizeActivationUnderstanding({
        ...activationUnderstanding,
        completionAction: {
          ...activationUnderstanding.completionAction,
          label: value.trim(),
          destination: normalized.includes("whatsapp") ? "whatsapp"
            : normalized.includes("mail") ? "email"
              : normalized.includes("telefone") ? "phone"
                : normalized.includes("http") ? "external_url"
                  : "native",
          confidence: 1,
          source: "business_confirmed",
        },
      });
    }
    let reconciled = await reconcileActivationState(actor, {
      ...session,
      activationUnderstanding,
      commercialArchitecture,
      answers: { ...session.answers, [key]: value },
    });
    if (key === "qualification.questions" && reconciled.discoveryPlan && Array.isArray(value)) {
      const confirmedQuestions = value
        .map((item) => structuredJourneyQuestionSchema.safeParse(item))
        .filter((item) => item.success)
        .map((item) => item.data);
      if (confirmedQuestions.length < 2) throw new Error("Confirme pelo menos duas perguntas para a descoberta assistida.");
      reconciled = await reconcileActivationState(actor, {
        ...reconciled,
        discoveryPlan: {
        ...reconciled.discoveryPlan,
        questions: confirmedQuestions.slice(0, 4),
        provenance: { ...reconciled.discoveryPlan.provenance, source: "business_confirmed" },
        },
      });
    }
    const next = await this.repository.update(actor, {
      ...reconciled,
      status: "waiting_answers",
    });
    await this.repository.addMessage(actor, id, "user", typeof value === "string" ? value : JSON.stringify(value), { kind: "answer", key });
    if (actor.persistence === "database") {
      const database = createServiceClient();
      if (database) await Promise.all([
        recordPlatformGrowthEvent(database, { eventName: "onboarding_stage_completed", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { stage: key }, idempotencyKey: `onboarding_stage_completed:${id}:${key}` }),
        recordPlatformGrowthEvent(database, { eventName: "onboarding_blocking_question_answered", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { key }, idempotencyKey: `onboarding_blocking_question_answered:${id}:${key}` }),
      ]).catch(() => undefined);
    }
    return next;
  }

  async generate(actor: AISetupActor, id: string) {
    let session = await this.get(actor, id);
    await requireActivationPreflight(actor);
    if (!session.extractedProfile) session = await this.analyze(actor, id);
    session = await reconcileActivationState(actor, session);
    if (session.commercialArchitecture ? !session.architectureReviewed : !session.actionsConfirmed) throw new Error("Confirme a interpretação do negócio antes de criar a primeira versão.");
    if (session.commercialArchitecture) {
      const architectureGate = validateCommercialArchitectureForMaterialization(session.commercialArchitecture);
      if (!architectureGate.valid) throw new Error(architectureGate.issues[0]?.message || "A arquitetura comercial ainda possui inconsistências.");
    }
    const blocking = session.missingRequirements.filter((item) => item.severity === "blocking" && item.status !== "verified");
    if (blocking.length) throw new Error("Confirme todas as informações necessárias antes de criar a primeira versão.");
    if (session.activationUnderstanding?.status === "degraded") {
      throw new Error("A análise contextual está degradada. Tente analisar novamente antes de criar a primeira versão.");
    }
    if (session.commercialArchitecture?.status === "degraded") {
      throw new Error("A arquitetura comercial está degradada. Tente analisar novamente com mais contexto antes de criar a primeira versão.");
    }
    if (recommendationSelected(session) && (
      !session.discoveryPlan
      || !discoveryPlanIsReady(session.discoveryPlan)
      || session.answers["qualification.questions"] == null
    )) {
      throw new Error("A recomendação precisa de ofertas, DiscoveryPlan e perguntas confirmadas antes da geração.");
    }
    session = await this.repository.update(actor, { ...session, status: "generating", lastError: undefined });
    const input = compositionInput(session);
    const baseProfile = session.extractedProfile || new RuleBasedBusinessAnalyzer().analyze(input);
    const selectedActions = session.visitorActions?.length
      ? session.visitorActions
      : session.commercialArchitecture
        ? visitorActionsFromCommercialArchitecture(session.commercialArchitecture, true)
      : session.activationUnderstanding
        ? actionsFromActivationUnderstanding(session.activationUnderstanding)
        : defaultVisitorActions(baseProfile, session.initialInput.description);
    const profile = profileWithVisitorActions(baseProfile, selectedActions);
    const selectedCapabilities = session.commercialArchitecture
      ? capabilitiesFromCommercialArchitecture(session.commercialArchitecture, capabilityPlanner.planForVisitorActions(profile, selectedActions))
      : capabilityPlanner.planForVisitorActions(profile, selectedActions);
    const aiJourney = isAIConfigured() ? async () => getAIProvider().composeJourney({
      input,
      profile,
      capabilities: selectedCapabilities,
      answers: session.answers,
      discoveryPlan: session.discoveryPlan,
      commercialArchitecture: session.commercialArchitecture,
      workspaceId: actor.workspaceId,
      setupSessionId: id,
      userId: actor.userId,
    }) : undefined;
    const orchestrator = new CompositionOrchestrator(
      { analyze: () => profile },
      { plan: () => selectedCapabilities },
      journeyComposer,
      visualComposer,
      aiJourney,
      session.commercialArchitecture,
    );
    try {
      const generated = await orchestrator.compose(input);
      let project = materializeSetupAnswers({
        ...generated,
        workspaceId: actor.workspaceId,
        status: "draft",
        capabilities: selectedCapabilities,
        dataRequirements: mergeProjectRequirements(generated, session),
      }, session);
      project = ensureVisitorActionTargets(project, selectedActions);
      project = applyVisitorActionsToProject(project, { visitorActions: selectedActions });
      project = applyBrandIdentity(project, session);
      const instruction = initialSiteInstruction(project, { ...session, visitorActions: selectedActions });
      const plannerSuggestion = suggestSiteStructure(project, instruction);
      let suggestion = plannerSuggestion;
      let siteUsedFallback = !isAIConfigured();
      if (isAIConfigured()) {
        try {
          suggestion = suggestedSiteStructureSchema.parse(await getAIProvider().composeSiteStructure({
            workspaceId: actor.workspaceId,
            projectId: project.id,
            setupSessionId: id,
            userId: actor.userId,
            instruction,
            target: "site",
            businessShape: inferBusinessShape(project),
            plannerSuggestion,
            currentSite: project.presence,
            business: {
              name: project.name,
              description: project.description,
              category: project.category,
              audience: project.audience,
              primaryGoal: project.primaryGoal,
              visualDirection: project.visualDirection,
              brand: project.brand,
              businessProfile: project.businessProfile,
              conversionGoals: project.conversionGoals,
              commercialConfig: project.commercialConfig,
            },
            commercialArchitecture: session.commercialArchitecture,
          }));
          siteUsedFallback = false;
        } catch {
          suggestion = plannerSuggestion;
          siteUsedFallback = true;
        }
      }
      project = materializeSuggestedSiteStructure(project, suggestion).project;
      const next = await this.repository.update(actor, stageGeneratedDraft(
        session,
        project,
        session.usedFallback || siteUsedFallback,
      ));
      await this.repository.addMessage(actor, id, "assistant", "Sua primeira versão foi criada como rascunho e está pronta para teste.", { kind: "generation", projectId: project.id });
      return next;
    } catch (error) {
      await this.repository.update(actor, { ...session, status: "failed", lastError: error instanceof Error ? error.message : "Falha ao gerar a jornada." });
      throw error;
    }
  }

  async complete(actor: AISetupActor, id: string, projectId?: string) {
    const session = await this.get(actor, id);
    if (!session.projectDraft) throw new Error("Crie a primeira versão antes de concluir o onboarding.");
    const persistedProjectId = projectId || session.projectId;
    if (!persistedProjectId) throw new Error("Salve o negócio antes de concluir a configuração.");
    await assertProjectAccess(actor, persistedProjectId, "write");
    if (session.commercialArchitecture && session.architectureReviewed) {
      const persistedProject = actor.persistence === "database" ? await loadProjectForActor(actor, persistedProjectId) : null;
      await projectCommercialContextService.materializeActivationContext(actor, session, persistedProjectId, persistedProject || { ...(session.projectDraft as Project), id: persistedProjectId });
    }
    return this.repository.update(actor, { ...session, status: "completed", projectId: persistedProjectId });
  }

  async finalizeProject(actor: AISetupActor, id: string, projectId: string, applyVerifiedFacts: boolean) {
    const session = await this.get(actor, id);
    if (!session.projectDraft) throw new Error("Crie a primeira versão antes de concluir o onboarding.");
    await assertProjectAccess(actor, projectId, "write");
    if (actor.persistence === "memory") {
      const commercialContext = session.commercialArchitecture && session.architectureReviewed
        ? await projectCommercialContextService.materializeActivationContext(actor, session, projectId, { ...(session.projectDraft as Project), id: projectId })
        : null;
      const completed = await this.repository.update(actor, { ...session, status: "completed", projectId });
      return { session: completed, project: session.projectDraft, summary: { sourcesAttached: 0, factsAttached: 0, applied: 0, skipped: 0, ...(commercialContext ? { commercialContextRevision: commercialContext.revision } : {}) } };
    }
    const client = createServiceClient();
    if (!client) throw new Error("Supabase não configurado.");
    const { data: attached, error } = await client.rpc("attach_ai_setup_sources_to_project", {
      p_workspace_id: actor.workspaceId,
      p_session_id: id,
      p_project_id: projectId,
      p_actor_id: actor.userId,
    });
    if (error) throw new Error("Não foi possível vincular as fontes ao projeto.");
    await materializeBrandLogo(actor, session, projectId);
    let applied = { applied: 0, skipped: 0 };
    if (applyVerifiedFacts) {
      const sources = await sourceRepository.list(actor, projectId);
      const factGroups = await Promise.all(sources.map((source) => sourceRepository.listFacts(actor, source.id)));
      const factIds = factGroups.flat().filter((fact) => fact.verificationStatus === "verified" && !fact.appliedAt).map((fact) => fact.id);
      if (factIds.length) applied = await applyExtractedFacts(actor, { projectId, factIds });
    }
    const requirements = await reconcileProjectRequirements(actor, projectId);
    const persistedProject = await loadProjectForActor(actor, projectId);
    if (!persistedProject) throw new Error("Não foi possível carregar o projeto para materializar o contexto comercial.");
    const commercialContext = session.commercialArchitecture && session.architectureReviewed
      ? await projectCommercialContextService.materializeActivationContext(actor, session, projectId, persistedProject)
      : null;
    await activateTrialAfterFirstStructure(client, actor.workspaceId);
    await Promise.all([
      recordPlatformGrowthEvent(client, {
        eventName: "first_structure_generated",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        metadata: { projectId, usedFallback: Boolean(session.usedFallback), source: session.usedFallback ? "fallback" : "ai" },
        idempotencyKey: `first_structure_generated:${actor.workspaceId}`,
      }),
      recordPlatformGrowthEvent(client, {
        eventName: "trial_started",
        userId: actor.userId,
        workspaceId: actor.workspaceId,
        metadata: { projectId },
        idempotencyKey: `trial_started:${actor.workspaceId}`,
      }),
    ]).catch(() => undefined);
    await recordPlatformGrowthEvent(client, {
      eventName: "onboarding_completed",
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      metadata: { projectId },
      idempotencyKey: `onboarding_completed:${actor.userId}`,
    }).catch(() => undefined);
    const completed = await this.repository.update(actor, { ...session, status: "completed", projectId });
    return {
      session: completed,
      project: persistedProject,
      summary: { ...(attached as Record<string, number>), ...applied, requirementsUpdated: requirements.length, ...(commercialContext ? { commercialContextRevision: commercialContext.revision } : {}) },
    };
  }
}

export const aiSetupService = new AISetupService();
