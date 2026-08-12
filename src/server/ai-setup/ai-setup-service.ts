import "server-only";

import { randomUUID } from "node:crypto";
import { extractedBusinessSourceSchema, type AISetupSession, type ExtractedBusinessSource, type SetupQuestion, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { materializeSetupAnswers } from "@/features/ai-setup/materialize-setup-answers";
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
import { assertProjectAccess } from "@/server/auth/project-access";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { createPresencePage } from "@/features/presence/presence-page-service";
import type { DataRequirement, ExperienceCompositionInput, Project } from "@/types";

export class AISetupNotFoundError extends Error {}

function compositionInput(session: AISetupSession): ExperienceCompositionInput {
  const destinationAnswer = Object.entries(session.answers).find(([key]) => key.endsWith(".destination") || key.endsWith(".completion"))?.[1];
  const objective = session.answers["qualification.objective"];
  return {
    businessName: session.initialInput.businessName,
    businessDescription: session.initialInput.description,
    primaryGoal: typeof objective === "string" && objective.trim() ? objective : "Criar uma jornada comercial",
    primaryDestination: typeof destinationAnswer === "string" && destinationAnswer.trim()
      ? destinationAnswer
      : session.initialInput.phone ? "WhatsApp" : session.initialInput.websiteUrl ? "Site" : "Formulário",
    slug: slugify(session.initialInput.businessName),
    phone: session.initialInput.phone,
    websiteUrl: session.initialInput.websiteUrl,
  };
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

function mergeProjectRequirements(project: Project, session: AISetupSession) {
  const byKey = new Map(session.missingRequirements.map((item) => [item.key, item]));
  return (project.dataRequirements || []).map((item) => byKey.get(item.key) || item);
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
      await sourceRepository.attachToSession(actor, sources.map((source) => source.id), created.id);
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
        sourceData.push({ ...parsed.data, facts: reviewed.filter((fact) => fact.verificationStatus !== "rejected").map((fact) => ({ key: fact.key, value: fact.value, origin: source.type === "website" ? "website" as const : "document" as const, sourceId: source.id, evidenceExcerpt: fact.evidenceExcerpt, confidence: fact.confidence || 0, verificationStatus: fact.verificationStatus === "verified" ? "verified" as const : fact.verificationStatus === "invalid" ? "invalid" as const : "needs_confirmation" as const })) });
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
    const questions = providerQuestions?.filter((item) => validKeys.has(item.key)).slice(0, 5);
    const next = await this.repository.update(actor, {
      ...session,
      status: "waiting_answers",
      extractedProfile: profile,
      missingRequirements: requirements,
      questions: questions?.length ? questions : planAdaptiveQuestions(requirements, session.answers),
      usedFallback,
    });
    await this.repository.addMessage(actor, id, "assistant", "Analisei o negócio e preparei as perguntas que faltam para montar a jornada.", { kind: "analysis", usedFallback });
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
      questions: planAdaptiveQuestions(requirements, answers),
    });
    await this.repository.addMessage(actor, id, "user", typeof value === "string" ? value : JSON.stringify(value), { kind: "answer", key });
    return next;
  }

  async generate(actor: AISetupActor, id: string) {
    let session = await this.get(actor, id);
    if (!session.extractedProfile) session = await this.analyze(actor, id);
    session = await this.repository.update(actor, { ...session, status: "generating", lastError: undefined });
    const input = compositionInput(session);
    const profile = session.extractedProfile || new RuleBasedBusinessAnalyzer().analyze(input);
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
      const requestedSurface = session.initialInput.requestedSurface || "recommend";
      const surface = requestedSurface === "recommend" ? "business_site" : requestedSurface;
      if (surface !== "conversion_direct") {
        const page = createPresencePage(project.id, surface === "landing_page" ? "Landing principal" : "Início", surface === "landing_page" ? "landing" : "home");
        page.title = project.name;
        page.description = project.description;
        page.defaultConversionGoalId = project.conversionGoals?.find((goal) => goal.isPrimary && goal.isActive)?.id || project.conversionGoals?.find((goal) => goal.isActive)?.id;
        const hero = page.sections.find((section) => section.type === "hero");
        if (hero && page.defaultConversionGoalId) hero.content = { ...hero.content, primaryAction: { type: "start_conversion_goal", label: project.primaryGoal || "Começar", conversionGoalId: page.defaultConversionGoalId, style: "primary" } };
        const cta = page.sections.find((section) => section.type === "conversion_cta");
        if (cta && page.defaultConversionGoalId) cta.content = { primaryAction: { type: "start_conversion_goal", label: project.primaryGoal || "Começar", conversionGoalId: page.defaultConversionGoalId, style: "primary" } };
        project = { ...project, presence: { pages: [page] } };
      }
      const next = await this.repository.update(actor, {
        ...session,
        status: "review",
        projectId: project.id,
        projectDraft: project,
        usedFallback: session.usedFallback || !isAIConfigured(),
      });
      await this.repository.addMessage(actor, id, "assistant", "A jornada foi composta como rascunho e está pronta para revisão no editor.", { kind: "generation", projectId: project.id });
      return next;
    } catch (error) {
      await this.repository.update(actor, { ...session, status: "failed", lastError: error instanceof Error ? error.message : "Falha ao gerar a jornada." });
      throw error;
    }
  }

  async complete(actor: AISetupActor, id: string, projectId?: string) {
    const session = await this.get(actor, id);
    if (!session.projectDraft) throw new Error("Gere a jornada antes de concluir o onboarding.");
    return this.repository.update(actor, { ...session, status: "completed", projectId: projectId || session.projectId });
  }

  async finalizeProject(actor: AISetupActor, id: string, projectId: string, applyVerifiedFacts: boolean) {
    const session = await this.get(actor, id);
    if (!session.projectDraft) throw new Error("Gere a jornada antes de concluir o onboarding.");
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
    let applied = { applied: 0, skipped: 0 };
    if (applyVerifiedFacts) {
      const sources = await sourceRepository.list(actor, projectId);
      const factGroups = await Promise.all(sources.map((source) => sourceRepository.listFacts(actor, source.id)));
      const factIds = factGroups.flat().filter((fact) => fact.verificationStatus === "verified" && !fact.appliedAt).map((fact) => fact.id);
      if (factIds.length) applied = await applyExtractedFacts(actor, { projectId, factIds });
    }
    const requirements = await reconcileProjectRequirements(actor, projectId);
    const completed = await this.repository.update(actor, { ...session, status: "completed", projectId });
    return {
      session: completed,
      project: await loadProjectForActor(actor, projectId),
      summary: { ...(attached as Record<string, number>), ...applied, requirementsUpdated: requirements.length },
    };
  }
}

export const aiSetupService = new AISetupService();
