import "server-only";

import { aiSetupSessionSchema, type AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { createServiceClient } from "@/lib/supabase/server";
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
    visitorActions: row.visitor_actions || [],
    actionsConfirmed: row.actions_confirmed || false,
    answers: row.answers || {},
    missingRequirements: row.missing_requirements || [],
    questions: row.questions || [],
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
    visitor_actions: session.visitorActions,
    actions_confirmed: session.actionsConfirmed,
    answers: session.answers,
    missing_requirements: session.missingRequirements,
    questions: session.questions,
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

  async update(actor: AISetupActor, session: AISetupSession) {
    const next = aiSetupSessionSchema.parse({ ...session, updatedAt: new Date().toISOString() });
    if (actor.persistence === "memory") {
      if (!sessions.has(next.id)) throw new Error("Sessão de onboarding não encontrada.");
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
      .single();
    if (error) persistenceFailure("update_session", error, "Não foi possível salvar o andamento da configuração.");
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
