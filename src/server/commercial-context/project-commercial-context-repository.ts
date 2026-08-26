import "server-only";

import {
  commercialContextProposalSchema,
  projectCommercialContextSchema,
  type CommercialContextProposal,
  type ProjectCommercialContext,
} from "@/features/commercial-context/project-commercial-context.schema";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";

declare global {
  var __sobeProjectCommercialContexts: Map<string, ProjectCommercialContext> | undefined;
  var __sobeCommercialContextProposals: Map<string, CommercialContextProposal> | undefined;
}

const memoryContexts = globalThis.__sobeProjectCommercialContexts ??= new Map<string, ProjectCommercialContext>();
const memoryProposals = globalThis.__sobeCommercialContextProposals ??= new Map<string, CommercialContextProposal>();

export class CommercialContextRevisionConflictError extends Error {}

function rowToContext(row: Record<string, unknown>) {
  return projectCommercialContextSchema.parse({
    ...(row.context as Record<string, unknown>),
    projectId: row.project_id,
    schemaVersion: row.schema_version,
    revision: row.revision,
    sourceCoverage: row.source_coverage,
    lastAnalyzedAt: row.last_analyzed_at,
    lastConfirmedAt: row.last_confirmed_at,
    updatedAt: row.updated_at,
  });
}

function rowToProposal(row: Record<string, unknown>) {
  return commercialContextProposalSchema.parse({
    id: row.id,
    projectId: row.project_id,
    baseRevision: row.base_revision,
    status: row.status,
    reason: row.reason,
    evidence: row.evidence,
    proposedContext: row.proposed_context,
    affectedIntentIds: row.affected_intent_ids,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  });
}

export type CommercialContextAuditAction =
  | "commercial_context.generated"
  | "commercial_context.confirmed"
  | "commercial_context.user_edited"
  | "commercial_context.ai_proposed_update"
  | "commercial_context.update_accepted"
  | "commercial_context.update_rejected"
  | "commercial_context.source_reanalyzed"
  | "commercial_context.operational_sync";

export class ProjectCommercialContextRepository {
  async audit(actor: AuthenticatedActor, input: { projectId: string; objectType: string; objectId: string; action: CommercialContextAuditAction; before?: unknown; after?: unknown }) {
    if (actor.persistence === "memory") return;
    const database = createServiceClient();
    if (!database) throw new Error("Persistência da auditoria comercial indisponível.");
    const { error } = await database.from("commercial_audit_log").insert({ workspace_id: actor.workspaceId, project_id: input.projectId, actor_id: actor.userId, object_type: input.objectType, object_id: input.objectId, action: input.action, before_state: input.before ?? null, after_state: input.after ?? null });
    if (error) throw new Error("Não foi possível registrar a auditoria do contexto comercial.");
  }

  async get(actor: AuthenticatedActor, projectId: string) {
    if (actor.persistence === "memory") return structuredClone(memoryContexts.get(projectId) || null);
    const database = createServiceClient();
    if (!database) throw new Error("Persistência do contexto comercial indisponível.");
    const { data, error } = await database.from("project_commercial_contexts").select("*").eq("project_id", projectId).maybeSingle();
    if (error) throw new Error("Não foi possível carregar o contexto comercial.");
    return data ? rowToContext(data) : null;
  }

  async upsert(actor: AuthenticatedActor, context: ProjectCommercialContext, action: CommercialContextAuditAction, expectedRevision?: number) {
    const parsed = projectCommercialContextSchema.parse(context);
    const before = await this.get(actor, parsed.projectId);
    if (expectedRevision !== undefined && (before?.revision || 0) !== expectedRevision) throw new CommercialContextRevisionConflictError("O contexto comercial mudou. Recarregue antes de salvar.");
    if (actor.persistence === "memory") {
      memoryContexts.set(parsed.projectId, structuredClone(parsed));
      return structuredClone(parsed);
    }
    const database = createServiceClient();
    if (!database) throw new Error("Persistência do contexto comercial indisponível.");
    const { data, error } = await database.rpc("save_project_commercial_context", {
      p_workspace_id: actor.workspaceId,
      p_project_id: parsed.projectId,
      p_actor_id: actor.userId,
      p_expected_revision: expectedRevision ?? before?.revision ?? 0,
      p_schema_version: parsed.schemaVersion,
      p_revision: parsed.revision,
      p_context: parsed,
      p_source_coverage: parsed.sourceCoverage,
      p_confidence: parsed.intentContexts.length ? Math.min(...parsed.intentContexts.map((intent) => intent.confidence)) : null,
      p_last_analyzed_at: parsed.lastAnalyzedAt,
      p_last_confirmed_at: parsed.lastConfirmedAt,
      p_action: action,
    });
    if (error?.code === "40001" || error?.message.includes("commercial_context_revision_conflict")) throw new CommercialContextRevisionConflictError("O contexto comercial mudou. Recarregue antes de salvar.");
    if (error || !data) throw new Error("Não foi possível salvar e auditar o contexto comercial.");
    return rowToContext(data as Record<string, unknown>);
  }

  async createProposal(actor: AuthenticatedActor, proposal: CommercialContextProposal) {
    const parsed = commercialContextProposalSchema.parse(proposal);
    if (actor.persistence === "memory") {
      memoryProposals.set(parsed.id, structuredClone(parsed));
      return structuredClone(parsed);
    }
    const database = createServiceClient();
    if (!database) throw new Error("Persistência do contexto comercial indisponível.");
    const { data, error } = await database.from("project_commercial_context_proposals").insert({
      id: parsed.id,
      project_id: parsed.projectId,
      base_revision: parsed.baseRevision,
      status: parsed.status,
      reason: parsed.reason,
      evidence: parsed.evidence,
      proposed_context: parsed.proposedContext,
      affected_intent_ids: parsed.affectedIntentIds,
      resolved_at: parsed.resolvedAt,
    }).select("*").single();
    if (error || !data) throw new Error("Não foi possível registrar a proposta de atualização.");
    await database.from("commercial_audit_log").insert({ workspace_id: actor.workspaceId, project_id: parsed.projectId, actor_id: actor.userId, object_type: "commercial_context_proposal", object_id: parsed.id, action: "commercial_context.ai_proposed_update", after_state: parsed });
    return rowToProposal(data);
  }

  async getProposal(actor: AuthenticatedActor, projectId: string, proposalId: string) {
    if (actor.persistence === "memory") {
      const proposal = memoryProposals.get(proposalId);
      return proposal?.projectId === projectId ? structuredClone(proposal) : null;
    }
    const database = createServiceClient();
    if (!database) throw new Error("Persistência do contexto comercial indisponível.");
    const { data, error } = await database.from("project_commercial_context_proposals").select("*").eq("id", proposalId).eq("project_id", projectId).maybeSingle();
    if (error) throw new Error("Não foi possível carregar a proposta.");
    return data ? rowToProposal(data) : null;
  }

  async resolveProposal(actor: AuthenticatedActor, proposal: CommercialContextProposal, status: "accepted" | "rejected") {
    const resolved = commercialContextProposalSchema.parse({ ...proposal, status, resolvedAt: new Date().toISOString() });
    if (actor.persistence === "memory") {
      memoryProposals.set(resolved.id, structuredClone(resolved));
      return resolved;
    }
    const database = createServiceClient();
    if (!database) throw new Error("Persistência do contexto comercial indisponível.");
    const { data, error } = await database.from("project_commercial_context_proposals").update({ status, resolved_at: resolved.resolvedAt }).eq("id", resolved.id).eq("project_id", resolved.projectId).eq("status", "pending").select("*").maybeSingle();
    if (error || !data) throw new Error("Não foi possível concluir a proposta.");
    await database.from("commercial_audit_log").insert({ workspace_id: actor.workspaceId, project_id: resolved.projectId, actor_id: actor.userId, object_type: "commercial_context_proposal", object_id: resolved.id, action: status === "accepted" ? "commercial_context.update_accepted" : "commercial_context.update_rejected", before_state: proposal, after_state: resolved });
    return rowToProposal(data);
  }
}

export const projectCommercialContextRepository = new ProjectCommercialContextRepository();
