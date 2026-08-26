import "server-only";

import { aiSetupSessionSchema, type AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { createServiceClient } from "@/lib/supabase/server";
import { AISetupNotFoundError } from "@/server/ai-setup/ai-setup-errors";
import type { AISetupActor } from "@/server/auth/setup-actor";

declare global {
  var __smartBioAISetupSessions: Map<string, AISetupSession> | undefined;
}

const sessions = globalThis.__smartBioAISetupSessions ??= new Map<string, AISetupSession>();

function persistenceFailure(operation: string, error: { code?: string } | null, userMessage: string): never {
  console.error("ai_setup_persistence_failed", { operation, code: error?.code });
  throw new Error(userMessage);
}

function rowToSession(row: Record<string, unknown>): AISetupSession {
  return aiSetupSessionSchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id || undefined,
    status: row.status,
    initialInput: row.initial_input,
    extractedProfile: row.extracted_profile || undefined,
    activationUnderstanding: row.activation_understanding || undefined,
    visitorActions: row.visitor_actions || [],
    actionsConfirmed: row.actions_confirmed || false,
    answers: row.answers || {},
    missingRequirements: row.missing_requirements || [],
    questions: row.questions || [],
    discoveryPlan: row.discovery_plan || undefined,
    sources: row.sources || [],
    projectDraft: row.project_draft || undefined,
    lastError: row.last_error || undefined,
    usedFallback: row.used_fallback || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function sessionToRow(session: AISetupSession, actor: AISetupActor) {
  return {
    id: session.id,
    workspace_id: actor.workspaceId,
    project_id: session.projectId || null,
    created_by: actor.userId,
    status: session.status,
    initial_input: session.initialInput,
    extracted_profile: session.extractedProfile || null,
    activation_understanding: session.activationUnderstanding || null,
    visitor_actions: session.visitorActions,
    actions_confirmed: session.actionsConfirmed,
    answers: session.answers,
    missing_requirements: session.missingRequirements,
    questions: session.questions,
    discovery_plan: session.discoveryPlan || null,
    sources: session.sources,
    project_draft: session.projectDraft || null,
    last_error: session.lastError || null,
    used_fallback: session.usedFallback,
    updated_at: session.updatedAt,
  };
}

export class AISetupRepository {
  async create(actor: AISetupActor, session: AISetupSession) {
    if (actor.persistence === "memory") {
      sessions.set(session.id, structuredClone(session));
      return session;
    }
    const client = createServiceClient();
    if (!client) throw new Error("Persistência do onboarding indisponível.");
    const { data, error } = await client.from("ai_setup_sessions").insert(sessionToRow(session, actor)).select("*").single();
    if (error) persistenceFailure("create_session", error, "Não foi possível iniciar a configuração.");
    return rowToSession(data);
  }

  async createIdempotent(actor: AISetupActor, session: AISetupSession) {
    const existing = await this.get(actor, session.id);
    if (existing) return existing;
    if (actor.persistence === "memory") {
      sessions.set(session.id, structuredClone(session));
      return session;
    }
    const client = createServiceClient();
    if (!client) throw new Error("Persistência do onboarding indisponível.");
    const { data, error } = await client
      .from("ai_setup_sessions")
      .insert(sessionToRow(session, actor))
      .select("*")
      .single();
    if (!error && data) return rowToSession(data);
    if (error?.code === "23505") {
      const retry = await this.get(actor, session.id);
      if (retry) return retry;
    }
    persistenceFailure(
      "create_session_idempotent",
      error,
      "Não foi possível iniciar a configuração.",
    );
  }

  async get(actor: AISetupActor, id: string) {
    if (actor.persistence === "memory") {
      const session = sessions.get(id);
      return session?.workspaceId === actor.workspaceId ? structuredClone(session) : null;
    }
    const client = createServiceClient();
    if (!client) return null;
    const { data, error } = await client
      .from("ai_setup_sessions")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", actor.workspaceId)
      .eq("created_by", actor.userId)
      .maybeSingle();
    if (error) persistenceFailure("load_session", error, "Não foi possível carregar a configuração.");
    return data ? rowToSession(data) : null;
  }

  async latestActive(actor: AISetupActor) {
    if (actor.persistence === "memory") {
      return [...sessions.values()]
        .filter(
          (session) =>
            session.workspaceId === actor.workspaceId &&
            !["completed", "failed"].includes(session.status),
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((session) => structuredClone(session))[0] || null;
    }
    const client = createServiceClient();
    if (!client) return null;
    const { data, error } = await client
      .from("ai_setup_sessions")
      .select("*")
      .eq("workspace_id", actor.workspaceId)
      .eq("created_by", actor.userId)
      .in("status", [
        "collecting",
        "analyzing",
        "waiting_answers",
        "generating",
        "review",
      ])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error)
      persistenceFailure(
        "load_active_session",
        error,
        "Não foi possível carregar a configuração em andamento.",
      );
    return data ? rowToSession(data) : null;
  }

  async update(actor: AISetupActor, session: AISetupSession) {
    const next = aiSetupSessionSchema.parse({ ...session, updatedAt: new Date().toISOString() });
    if (actor.persistence === "memory") {
      if (!sessions.has(next.id))
        throw new AISetupNotFoundError("Sessão de onboarding não encontrada.");
      sessions.set(next.id, structuredClone(next));
      return next;
    }
    const client = createServiceClient();
    if (!client) throw new Error("Persistência do onboarding indisponível.");
    const { data, error } = await client
      .from("ai_setup_sessions")
      .update(sessionToRow(next, actor))
      .eq("id", next.id)
      .eq("workspace_id", actor.workspaceId)
      .eq("created_by", actor.userId)
      .select("*")
      .maybeSingle();
    if (!data && (!error || error.code === "PGRST116"))
      throw new AISetupNotFoundError("Sessão de onboarding não encontrada.");
    if (error)
      persistenceFailure(
        "update_session",
        error,
        "Não foi possível salvar o andamento da configuração.",
      );
    return rowToSession(data);
  }

  async addMessage(actor: AISetupActor, sessionId: string, role: "assistant" | "user" | "system", content: string, metadata: Record<string, unknown> = {}) {
    if (actor.persistence === "memory") return;
    const client = createServiceClient();
    if (!client) return;
    const { error } = await client.from("ai_setup_messages").insert({
      session_id: sessionId,
      role,
      content,
      metadata,
    });
    if (error) persistenceFailure("add_message", error, "Não foi possível salvar a mensagem da configuração.");
  }
}

export const aiSetupRepository = new AISetupRepository();
