import "server-only";

import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import {
  commercialContextProposalSchema,
  projectCommercialContextSchema,
  type CommercialContextEvidence,
  type ProjectCommercialContext,
} from "@/features/commercial-context/project-commercial-context.schema";
import {
  mergeProjectCommercialContexts,
  projectCommercialContextFromActivation,
  reconcileOperationalProjectContext,
} from "@/features/commercial-context/project-commercial-context";
import type { Project } from "@/types";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import {
  CommercialContextRevisionConflictError,
  projectCommercialContextRepository,
  type ProjectCommercialContextRepository,
} from "@/server/commercial-context/project-commercial-context-repository";

export class ProjectCommercialContextService {
  constructor(private readonly repository: ProjectCommercialContextRepository = projectCommercialContextRepository) {}

  async get(actor: AuthenticatedActor, projectId: string) {
    await assertProjectAccess(actor, projectId, "read");
    return this.repository.get(actor, projectId);
  }

  async materializeActivationContext(actor: AuthenticatedActor, session: AISetupSession, projectId: string, project: Project) {
    await assertProjectAccess(actor, projectId, "write");
    if (!session.commercialArchitecture || !session.architectureReviewed) throw new Error("Confirme a arquitetura comercial antes de materializar a memória do projeto.");
    const current = await this.repository.get(actor, projectId);
    const candidate = projectCommercialContextFromActivation({ projectId, project, session, current });
    const merged = mergeProjectCommercialContexts(current, candidate, session.architectureEdited ? "user_edit" : "generated");
    const saved = await this.repository.upsert(actor, merged, session.architectureEdited ? "commercial_context.user_edited" : current ? "commercial_context.confirmed" : "commercial_context.generated", current?.revision || 0);
    if (!current && !session.architectureEdited) await this.repository.audit(actor, { projectId, objectType: "project_commercial_context", objectId: projectId, action: "commercial_context.confirmed", after: { revision: saved.revision, confirmedAt: saved.lastConfirmedAt } });
    return saved;
  }

  async updateFromUser(actor: AuthenticatedActor, projectId: string, rawContext: unknown, expectedRevision: number) {
    await assertProjectAccess(actor, projectId, "write");
    const current = await this.repository.get(actor, projectId);
    if (!current) throw new Error("O projeto ainda não possui contexto comercial.");
    if (current.revision !== expectedRevision) throw new CommercialContextRevisionConflictError("O contexto comercial mudou. Recarregue antes de salvar.");
    const incoming = projectCommercialContextSchema.parse({ ...(rawContext as Record<string, unknown>), projectId, revision: expectedRevision + 1, updatedAt: new Date().toISOString() });
    const merged = mergeProjectCommercialContexts(current, incoming, "user_edit");
    return this.repository.upsert(actor, merged, "commercial_context.user_edited", expectedRevision);
  }

  async proposeUpdate(actor: AuthenticatedActor, input: { projectId: string; proposedContext: ProjectCommercialContext; reason: string; evidence?: CommercialContextEvidence[]; affectedIntentIds?: string[] }) {
    await assertProjectAccess(actor, input.projectId, "write");
    const current = await this.repository.get(actor, input.projectId);
    if (!current) throw new Error("O projeto ainda não possui contexto comercial.");
    return this.repository.createProposal(actor, commercialContextProposalSchema.parse({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      baseRevision: current.revision,
      status: "pending",
      reason: input.reason,
      evidence: input.evidence || input.proposedContext.evidence,
      proposedContext: { ...input.proposedContext, projectId: input.projectId, revision: current.revision + 1 },
      affectedIntentIds: input.affectedIntentIds || [],
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    }));
  }

  async acceptProposal(actor: AuthenticatedActor, projectId: string, proposalId: string) {
    await assertProjectAccess(actor, projectId, "write");
    const [current, proposal] = await Promise.all([this.repository.get(actor, projectId), this.repository.getProposal(actor, projectId, proposalId)]);
    if (!current || !proposal || proposal.status !== "pending") throw new Error("Proposta de atualização não encontrada.");
    if (current.revision !== proposal.baseRevision) throw new CommercialContextRevisionConflictError("O contexto mudou depois desta proposta. Gere uma nova comparação.");
    const merged = mergeProjectCommercialContexts(current, proposal.proposedContext, "accepted_proposal");
    const context = await this.repository.upsert(actor, merged, "commercial_context.update_accepted", current.revision);
    await this.repository.resolveProposal(actor, proposal, "accepted");
    return { context, proposal: { ...proposal, status: "accepted" as const } };
  }

  async rejectProposal(actor: AuthenticatedActor, projectId: string, proposalId: string) {
    await assertProjectAccess(actor, projectId, "write");
    const proposal = await this.repository.getProposal(actor, projectId, proposalId);
    if (!proposal || proposal.status !== "pending") throw new Error("Proposta de atualização não encontrada.");
    return this.repository.resolveProposal(actor, proposal, "rejected");
  }

  async synchronizeOperationalChanges(actor: AuthenticatedActor, project: Project) {
    await assertProjectAccess(actor, project.id, "write");
    const current = await this.repository.get(actor, project.id);
    if (!current) return null;
    const reconciled = reconcileOperationalProjectContext(current, project);
    const saved = await this.repository.upsert(actor, reconciled.context, "commercial_context.operational_sync", current.revision);
    return { context: saved, affectedIntentIds: reconciled.affectedIntentIds, changedLocationIds: reconciled.changedLocationIds };
  }

  async recordSourceReanalysis(actor: AuthenticatedActor, input: { projectId: string; sourceId: string; before?: unknown; after?: unknown }) {
    await assertProjectAccess(actor, input.projectId, "write");
    await this.repository.audit(actor, { projectId: input.projectId, objectType: "business_source", objectId: input.sourceId, action: "commercial_context.source_reanalyzed", before: input.before, after: input.after });
  }
}

export const projectCommercialContextService = new ProjectCommercialContextService();
