import "server-only";

import { randomUUID } from "node:crypto";
import { extractedBusinessSourceSchema, type AISetupSession, type ExtractedBusinessSource, type SetupQuestion, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
import { stageGeneratedDraft } from "@/features/ai-setup/stage-generated-draft";
import { applyVisitorActionsToProject, defaultVisitorActions, profileWithVisitorActions, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
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
import type { DataRequirement, ExperienceCompositionInput, Project } from "@/types";

export class AISetupNotFoundError extends Error {}

function compositionInput(session: AISetupSession): ExperienceCompositionInput {
  const destinationAnswer = Object.entries(session.answers).find(([key]) => key.endsWith(".destination") || key.endsWith(".completion"))?.[1];
  const objective = session.answers["qualification.objective"];
  return {
    businessName: session.initialInput.businessName,
    businessDescription: session.initialInput.description,
    primaryGoal: session.visitorActions?.find((action) => action.isPrimary)?.label || (typeof objective === "string" && objective.trim() ? objective : "Criar uma estrutura comercial"),
    primaryDestination: typeof destinationAnswer === "string" && destinationAnswer.trim()
      ? destinationAnswer
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

  async start(actor: AISetupActor, initialInput: AISetupSession["initialInput"], sources: SourceReference[] = []) {
    const now = new Date().toISOString();
    const session: AISetupSession = {
      id: randomUUID(),
      workspaceId: actor.workspaceId,
      status: "collecting",
      initialInput,
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
      const sourceIds = [...sources.map((source) => source.id), ...(initialInput.brandIdentity?.sourceId ? [initialInput.brandIdentity.sourceId] : [])];
      await sourceRepository.attachToSession(actor, sourceIds, created.id);
    }
    await this.repository.addMessage(actor, created.id, "user", initialInput.description, { kind: "business_description" });
    return created;
  }

  async get(actor: AISetupActor, id: string) {
    const session = await this.repository.get(actor, id);
    if (!session) throw new AISetupNotFoundError("Sessão de onboarding não encontrada.");
    return session;
  }

  async analyze(actor: AISetupActor, id: string) {
    let session = await this.get(actor, id);
    session = await this.repository.update(actor, { ...session, status: "analyzing", lastError: undefined });
    const input = compositionInput(session);
    const fallbackProfile = new RuleBasedBusinessAnalyzer().analyze(input);
    let profile = fallbackProfile;
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
        const result = await getAIProvider().analyzeBusiness({
          input,
          sources: sourceData,
          workspaceId: actor.workspaceId,
          setupSessionId: id,
          userId: actor.userId,
        });
        profile = result.profile;
      } catch {
        usedFallback = true;
      }
    }

    const capabilities = capabilityPlanner.plan(profile);
    const requirements = resolvedRequirements(draftCapabilityRequirements(capabilities), session.answers);
    if (isAIConfigured() && !usedFallback) {
      try {
        providerQuestions = await getAIProvider().generateMissingQuestions({
          profile,
          requirements,
          answers: session.answers,
          workspaceId: actor.workspaceId,
          setupSessionId: id,
          userId: actor.userId,
        });
      } catch {
        usedFallback = true;
      }
    }
    const validKeys = new Set(requirements.filter((item) => item.status !== "verified").map((item) => item.key));
    const questions = providerQuestions?.filter((item) => validKeys.has(item.key)).slice(0, 3);
    const next = await this.repository.update(actor, {
      ...session,
      status: "waiting_answers",
      extractedProfile: profile,
      visitorActions: session.visitorActions?.length ? session.visitorActions : defaultVisitorActions(profile),
      actionsConfirmed: session.actionsConfirmed || false,
      missingRequirements: requirements,
      questions: questions?.length ? questions.slice(0, 3) : planAdaptiveQuestions(requirements, session.answers, 3),
      usedFallback,
    });
    await this.repository.addMessage(actor, id, "assistant", "Analisei o negócio e destaquei as ações mais importantes. Confirme-as antes de continuarmos.", { kind: "analysis", usedFallback });
    return next;
  }

  async confirmVisitorActions(actor: AISetupActor, id: string, actions: VisitorActionSelection[]) {
    const session = await this.get(actor, id);
    if (!session.extractedProfile) throw new Error("Analise o negócio antes de confirmar as ações.");
    if (!actions.length) throw new Error("Escolha ao menos uma ação para o visitante.");
    if (actions.filter((action) => action.isPrimary).length !== 1) throw new Error("Marque uma única ação como principal.");
    const profile = profileWithVisitorActions(session.extractedProfile, actions);
    const requirements = resolvedRequirements(draftCapabilityRequirements(capabilityPlanner.plan(profile)), session.answers);
    const next = await this.repository.update(actor, {
      ...session,
      extractedProfile: profile,
      visitorActions: actions,
      actionsConfirmed: true,
      missingRequirements: requirements,
      questions: planAdaptiveQuestions(requirements, session.answers, 3),
      status: "waiting_answers",
    });
    await this.repository.addMessage(actor, id, "user", actions.map((action) => action.label).join(", "), { kind: "visitor_actions" });
    return next;
  }

  async answer(actor: AISetupActor, id: string, key: string, value: unknown) {
    const session = await this.get(actor, id);
    if (!session.missingRequirements.some((item) => item.key === key)) throw new Error("Essa pergunta não pertence à sessão atual.");
    const answers = { ...session.answers, [key]: value };
    const requirements = resolvedRequirements(session.missingRequirements, answers);
    const next = await this.repository.update(actor, {
      ...session,
      status: "waiting_answers",
      answers,
      missingRequirements: requirements,
      questions: planAdaptiveQuestions(requirements, answers, 3),
    });
    await this.repository.addMessage(actor, id, "user", typeof value === "string" ? value : JSON.stringify(value), { kind: "answer", key });
    return next;
  }

  async generate(actor: AISetupActor, id: string) {
    let session = await this.get(actor, id);
    if (!session.extractedProfile) session = await this.analyze(actor, id);
    session = await this.repository.update(actor, { ...session, status: "generating", lastError: undefined });
    const input = compositionInput(session);
    const baseProfile = session.extractedProfile || new RuleBasedBusinessAnalyzer().analyze(input);
    const selectedActions = session.visitorActions?.length ? session.visitorActions : defaultVisitorActions(baseProfile);
    const profile = profileWithVisitorActions(baseProfile, selectedActions);
    const aiJourney = isAIConfigured() ? async () => getAIProvider().composeJourney({
      input,
      profile,
      capabilities: capabilityPlanner.plan(profile),
      answers: session.answers,
      workspaceId: actor.workspaceId,
      setupSessionId: id,
      userId: actor.userId,
    }) : undefined;
    const orchestrator = new CompositionOrchestrator(
      { analyze: () => profile },
      capabilityPlanner,
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
        dataRequirements: mergeProjectRequirements(generated, session),
      }, session);
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
