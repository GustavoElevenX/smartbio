import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { applySiteProposalInputSchema, suggestSiteStructureInputSchema } from "@/features/site-composer/site-composer.schema";
import { createSiteStructureProposal, suggestSiteStructure } from "@/features/site-composer/site-structure-suggester";
import { applySiteOperationsToDraft } from "@/features/site-composer/materialize-site-structure";
import type { SiteStructureProposal } from "@/features/site-composer/site-composer.types";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { savePresencePagesForActor } from "@/server/presence/presence-page-service";
import { demoProjects } from "@/data/demo-projects";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import { inferBusinessShape } from "@/features/site-composer/business-shape";
import { suggestedSiteStructureSchema } from "@/features/site-composer/site-composer.schema";

const memoryProposals = new Map<string, SiteStructureProposal>();

async function loadComposerProject(actor: AuthenticatedActor, projectId: string) {
  if (actor.persistence === "memory") return demoProjects.find((project) => project.id === projectId) || null;
  return loadProjectForActor(actor, projectId);
}

async function getProposal(actor: AuthenticatedActor, proposalId: string) {
  if (actor.persistence === "memory") return memoryProposals.get(proposalId);
  const database = createServiceClient();
  if (!database) return undefined;
  const { data } = await database.from("ai_site_proposals").select("payload,status").eq("id", proposalId).eq("workspace_id", actor.workspaceId).maybeSingle();
  return data ? ({ ...(data.payload as SiteStructureProposal), status: data.status } as SiteStructureProposal) : undefined;
}

export async function suggestStructureForActor(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = suggestSiteStructureInputSchema.parse(raw);
  const project = await loadComposerProject(actor, projectId);
  if (!project) throw new Error("Projeto não encontrado.");
  const database = createServiceClient();
  if (actor.persistence === "database" && database) await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "ai_structure_suggestions" });
  const plannerSuggestion = suggestSiteStructure(project, input.instruction);
  let suggestion = plannerSuggestion;
  let usedAI = false;
  if (isAIConfigured()) {
    try {
      suggestion = suggestedSiteStructureSchema.parse(await getAIProvider().composeSiteStructure({
        workspaceId: actor.workspaceId,
        projectId,
        userId: actor.userId,
        instruction: input.instruction,
        target: input.target,
        pageId: input.pageId,
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
      usedAI = true;
    } catch {
      suggestion = { ...plannerSuggestion, warnings: [...plannerSuggestion.warnings, "A camada contextual de IA não respondeu; esta proposta usa o planner determinístico e continua revisável."] };
    }
  } else suggestion = { ...plannerSuggestion, warnings: [...plannerSuggestion.warnings, "Configure o provider de IA para acrescentar composição contextual ao planner determinístico."] };
  const proposal = { ...createSiteStructureProposal(project, input.target, input.instruction, input.pageId, suggestion, input.intent), usedAI };
  if (actor.persistence === "memory") memoryProposals.set(proposal.proposalId, proposal);
  else if (database) {
    const { error } = await database.from("ai_site_proposals").insert({ id: proposal.proposalId, workspace_id: actor.workspaceId, project_id: projectId, created_by: actor.userId, expected_version: project.version, target: input.target, page_id: input.pageId || null, payload: proposal, status: "pending" });
    if (error) throw new Error("Não foi possível registrar a proposta.");
  }
  return { proposalId: proposal.proposalId, suggestion: proposal.suggestion, operations: proposal.operations, expectedVersion: proposal.expectedVersion, usedAI };
}

export class SiteProposalConflictError extends Error {}

export async function applySiteProposalForActor(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = applySiteProposalInputSchema.parse(raw);
  const [project, proposal] = await Promise.all([loadComposerProject(actor, projectId), getProposal(actor, input.proposalId)]);
  if (!project || !proposal || proposal.projectId !== projectId) throw new Error("Proposta não encontrada.");
  if (proposal.status !== "pending" || project.version !== input.expectedVersion || proposal.expectedVersion !== input.expectedVersion) throw new SiteProposalConflictError("A proposta ficou desatualizada. Gere uma nova sugestão.");
  const selected = proposal.operations.filter((operation) => input.selectedOperations.includes(operation.id));
  if (selected.length !== input.selectedOperations.length) throw new Error("A seleção contém operações que não pertencem à proposta.");
  const database = createServiceClient();
  if (actor.persistence === "database" && database) await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "ai_page_edits" });
  const materialized = applySiteOperationsToDraft(project, selected);
  const pages = materialized.project.presence?.pages || [];
  const touched = new Set(materialized.touchedPageIds);
  if (actor.persistence === "database" && database) {
    const [pageEntitlement, sectionEntitlement] = await Promise.all([
      requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "presence_pages" }),
      requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "presence_sections_per_page" }),
    ]);
    const createdCount = [...touched].filter((pageId) => !project.presence?.pages.some((page) => page.id === pageId)).length;
    if (pageEntitlement.limit != null && (pageEntitlement.used || 0) + createdCount > pageEntitlement.limit) throw new Error(`A proposta excede o limite de ${pageEntitlement.limit} páginas do seu plano.`);
    const oversized = pages.find((page) => touched.has(page.id) && sectionEntitlement.limit != null && page.sections.length > sectionEntitlement.limit);
    if (oversized) throw new Error(`A página “${oversized.name}” excede o limite de ${sectionEntitlement.limit} seções do seu plano.`);
  }
  await savePresencePagesForActor(actor, projectId, [...touched].map((pageId) => {
    const page = pages.find((candidate) => candidate.id === pageId)!;
    const original = project.presence?.pages.find((candidate) => candidate.id === pageId);
    return { page, expectedVersion: original?.version || 0, deletedSectionIds: materialized.deletedSectionIds[pageId] || [] };
  }));
  if (actor.persistence === "memory") memoryProposals.set(proposal.proposalId, { ...proposal, status: "applied" });
  else if (database) await database.from("ai_site_proposals").update({ status: "applied", applied_at: new Date().toISOString(), selected_operation_ids: input.selectedOperations }).eq("id", proposal.proposalId).eq("workspace_id", actor.workspaceId);
  return { applied: true, draftOnly: true, selectedOperations: input.selectedOperations, pages: pages.filter((page) => touched.has(page.id)) };
}
