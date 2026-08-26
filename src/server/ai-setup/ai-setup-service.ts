import "server-only";

import { randomUUID } from "node:crypto";
import { extractedBusinessSourceSchema, setupDraftInputSchema, setupInitialInputSchema, structuredJourneyQuestionSchema, type AISetupSession, type ExtractedBusinessSource, type SetupDraftInput, type SetupInitialInput, type SetupQuestion, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { actionsFromActivationUnderstanding, deterministicActivationUnderstanding, markActionsConfirmed, markOfferingsConfirmed, normalizeActivationUnderstanding, understandingOfferingNames } from "@/features/ai-setup/activation-understanding";
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
  return [
    `Crie a primeira página específica de ${project.name}.`,
    project.description,
    project.category ? `Categoria: ${project.category}.` : "",
    actions ? `Ações confirmadas pelo usuário, em ordem de prioridade: ${actions}.` : "",
    verified ? `Informações confirmadas no onboarding: ${verified}.` : "",
    sources ? `Materiais analisados: ${sources}.` : "",
    "Mostre múltiplas ações legítimas quando existirem, conecte apenas goals reais e não invente fatos, preços, provas ou números.",
  ].filter(Boolean).join(" ");
}

function resolvedRequirements(requirements: DataRequirement[], answers: Record<string, unknown>) {
  return requirements.map((requirement): DataRequirement => answers[requirement.key] == null ? requirement : {
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
  const planned = planAdaptiveQuestions(planningRequirements, session.answers, 3, suggestions, structured);
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
  if (!session.actionsConfirmed || !recommendationSelected(session)) return undefined;
  if (answers["qualification.objective"] == null || answers["qualification.offerings"] == null) return undefined;
  const contextualNames = understandingOfferingNames(session.activationUnderstanding);
  const offeringNames = contextualNames.length
    ? contextualNames
    : offerNamesFromSetup(session.initialInput.description, answers["qualification.offerings"]);
  if (offeringNames.length < 2) return undefined;
  const primary = session.visitorActions.find((action) => action.isPrimary) || session.visitorActions[0];
  const declaredObjective = String(answers["qualification.objective"] || primary?.label || "Orientar o visitante").trim();
  const destination = String(answers["qualification.destination"] || (session.initialInput.phone ? "WhatsApp" : "Atendimento da equipe")).trim();
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
  const baseProfile = session.extractedProfile || new RuleBasedBusinessAnalyzer().analyze(compositionInput(session));
  const selectedActions = session.visitorActions.length
    ? session.visitorActions
    : session.activationUnderstanding
      ? actionsFromActivationUnderstanding(session.activationUnderstanding)
      : defaultVisitorActions(baseProfile, session.initialInput.description);
  const profile = profileWithVisitorActions(baseProfile, selectedActions);
  let answers = { ...session.answers };
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

  const capabilities = capabilityPlanner.planForVisitorActions(profile, selectedActions);
  const requirements = resolvedRequirements(
    requirementsForActions(draftCapabilityRequirements(capabilities), selectedActions, session.id, discoveryPlan),
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
    const input = compositionInput(session);
    const fallbackProfile = new RuleBasedBusinessAnalyzer().analyze(input);
    let profile = fallbackProfile;
    let activationUnderstanding = deterministicActivationUnderstanding({
      profile: fallbackProfile,
      businessDescription: session.initialInput.description,
      phone: session.initialInput.phone,
      websiteUrl: session.initialInput.websiteUrl,
    });
    let providerQuestions: SetupQuestion[] | undefined;
    let usedFallback = !isAIConfigured();

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
        const [result, contextualUnderstanding] = await Promise.all([
          provider.analyzeBusiness(analysisInput),
          provider.analyzeActivationUnderstanding(analysisInput),
        ]);
        profile = result.profile;
        activationUnderstanding = normalizeActivationUnderstanding(contextualUnderstanding);
      } catch {
        usedFallback = true;
      }
    }

    const proposedActions = actionsFromActivationUnderstanding(activationUnderstanding);
    const provisional = await reconcileActivationState(actor, {
      ...session,
      extractedProfile: profile,
      activationUnderstanding,
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
    await this.repository.addMessage(actor, id, "assistant", "Analisei o negócio e destaquei as ações mais importantes. Confirme-as antes de continuarmos.", { kind: "analysis", usedFallback });
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
    const reconciled = await reconcileActivationState(actor, {
      ...session,
      activationUnderstanding: confirmation.understanding,
      visitorActions: confirmation.actions,
      actionsConfirmed: true,
      discoveryPlan: undefined,
      status: "waiting_answers",
    });
    const next = await this.repository.update(actor, {
      ...reconciled,
    });
    await this.repository.addMessage(actor, id, "user", confirmation.actions.map((action) => action.label).join(", "), { kind: "visitor_actions", source: confirmation.understanding.source });
    return next;
  }

  async answer(actor: AISetupActor, id: string, key: string, value: unknown) {
    const session = await this.get(actor, id);
    if (!session.missingRequirements.some((item) => item.key === key)) throw new Error("Essa pergunta não pertence à sessão atual.");
    let activationUnderstanding = session.activationUnderstanding;
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
      if (database) await recordPlatformGrowthEvent(database, { eventName: "onboarding_stage_completed", userId: actor.userId, workspaceId: actor.workspaceId, metadata: { stage: key }, idempotencyKey: `onboarding_stage_completed:${id}:${key}` }).catch(() => undefined);
    }
    return next;
  }

  async generate(actor: AISetupActor, id: string) {
    let session = await this.get(actor, id);
    await requireActivationPreflight(actor);
    if (!session.extractedProfile) session = await this.analyze(actor, id);
    session = await reconcileActivationState(actor, session);
    if (!session.actionsConfirmed) throw new Error("Confirme a estratégia sugerida antes de criar a primeira versão.");
    const blocking = session.missingRequirements.filter((item) => item.severity === "blocking" && item.status !== "verified");
    if (blocking.length) throw new Error("Confirme todas as informações necessárias antes de criar a primeira versão.");
    if (session.activationUnderstanding?.status === "degraded") {
      throw new Error("A análise contextual está degradada. Tente analisar novamente antes de criar a primeira versão.");
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
      : session.activationUnderstanding
        ? actionsFromActivationUnderstanding(session.activationUnderstanding)
        : defaultVisitorActions(baseProfile, session.initialInput.description);
    const profile = profileWithVisitorActions(baseProfile, selectedActions);
    const selectedCapabilities = capabilityPlanner.planForVisitorActions(profile, selectedActions);
    const aiJourney = isAIConfigured() ? async () => getAIProvider().composeJourney({
      input,
      profile,
      capabilities: selectedCapabilities,
      answers: session.answers,
      discoveryPlan: session.discoveryPlan,
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
    return this.repository.update(actor, { ...session, status: "completed", projectId: persistedProjectId });
  }

  async finalizeProject(actor: AISetupActor, id: string, projectId: string, applyVerifiedFacts: boolean) {
    const session = await this.get(actor, id);
    if (!session.projectDraft) throw new Error("Crie a primeira versão antes de concluir o onboarding.");
    await assertProjectAccess(actor, projectId, "write");
    if (actor.persistence === "memory") {
      const completed = await this.repository.update(actor, { ...session, status: "completed", projectId });
      return { session: completed, project: session.projectDraft, summary: { sourcesAttached: 0, factsAttached: 0, applied: 0, skipped: 0 } };
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
      project: await loadProjectForActor(actor, projectId),
      summary: { ...(attached as Record<string, number>), ...applied, requirementsUpdated: requirements.length },
    };
  }
}

export const aiSetupService = new AISetupService();
