import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { createPresencePage, createPresenceSection } from "@/features/presence/presence-page-service";
import { applySiteProposalInputSchema, suggestSiteStructureInputSchema } from "@/features/site-composer/site-composer.schema";
import { createSiteStructureProposal } from "@/features/site-composer/site-structure-suggester";
import type { SiteStructureProposal } from "@/features/site-composer/site-composer.types";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { savePresencePageForActor } from "@/server/presence/presence-page-service";
import { demoProjects } from "@/data/demo-projects";

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
  const proposal = createSiteStructureProposal(project, input.target, input.instruction, input.pageId);
  if (actor.persistence === "memory") memoryProposals.set(proposal.proposalId, proposal);
  else if (database) {
    const { error } = await database.from("ai_site_proposals").insert({ id: proposal.proposalId, workspace_id: actor.workspaceId, project_id: projectId, created_by: actor.userId, expected_version: project.version, target: input.target, page_id: input.pageId || null, payload: proposal, status: "pending" });
    if (error) throw new Error("Não foi possível registrar a proposta.");
  }
  return { proposalId: proposal.proposalId, suggestion: proposal.suggestion, operations: proposal.operations, expectedVersion: proposal.expectedVersion };
}

export class SiteProposalConflictError extends Error {}

export async function applySiteProposalForActor(actor: AuthenticatedActor, projectId: string, raw: unknown) {
  await assertProjectAccess(actor, projectId, "write");
  const input = applySiteProposalInputSchema.parse(raw);
  const [project, proposal] = await Promise.all([loadComposerProject(actor, projectId), getProposal(actor, input.proposalId)]);
  if (!project || !proposal || proposal.projectId !== projectId) throw new Error("Proposta não encontrada.");
  if (proposal.status !== "pending" || project.version !== input.expectedVersion || proposal.expectedVersion !== input.expectedVersion) throw new SiteProposalConflictError("A proposta ficou desatualizada. Gere uma nova sugestão.");
  const selected = proposal.operations.filter((operation) => input.selectedOperations.includes(operation.id));
  const pages = structuredClone(project.presence?.pages || []);
  const touched = new Set<string>();
  for (const operation of selected) {
    if (operation.type === "add_page") {
      const page = createPresencePage(projectId, operation.page.name, operation.page.type, pages);
      page.path = operation.page.pathSuggestion;
      page.purpose = operation.page.purpose;
      page.description = operation.page.purpose;
      page.defaultConversionGoalId = operation.page.conversionGoalId;
      page.sections = operation.page.sections.map((suggested, order) => {
        const section = createPresenceSection(page.id, suggested.sectionType, order);
        return { ...section, title: suggested.purpose, content: { ...section.content, ...suggested.suggestedContent } };
      });
      pages.push(page);
      touched.add(page.id);
      continue;
    }
    const page = pages.find((candidate) => candidate.id === operation.pageId);
    if (!page) continue;
    touched.add(page.id);
    if (operation.type === "add_section") {
      const section = createPresenceSection(page.id, operation.section.sectionType, operation.at ?? page.sections.length);
      section.title = operation.section.purpose;
      section.content = { ...section.content, ...operation.section.suggestedContent };
      page.sections.splice(operation.at ?? page.sections.length, 0, section);
      page.sections.forEach((item, order) => { item.order = order; });
    } else if (operation.type === "remove_section") page.sections = page.sections.filter((section) => section.id !== operation.sectionId).map((section, order) => ({ ...section, order }));
    else if (operation.type === "move_section") {
      const index = page.sections.findIndex((section) => section.id === operation.sectionId);
      if (index >= 0) page.sections.splice(operation.to, 0, page.sections.splice(index, 1)[0]);
      page.sections.forEach((section, order) => { section.order = order; });
    } else if (operation.type === "rename_page") page.name = operation.name;
    else if (operation.type === "connect_goal") page.defaultConversionGoalId = operation.conversionGoalId;
    else if (operation.type === "update_section") {
      const index = page.sections.findIndex((section) => section.id === operation.sectionId);
      if (index >= 0) page.sections[index] = { ...page.sections[index], ...operation.patch };
    }
  }
  for (const pageId of touched) {
    const page = pages.find((candidate) => candidate.id === pageId)!;
    await savePresencePageForActor(actor, projectId, { page, expectedVersion: page.createdAt ? page.version || 1 : 0, deletedSectionIds: [] });
  }
  const database = createServiceClient();
  if (actor.persistence === "memory") memoryProposals.set(proposal.proposalId, { ...proposal, status: "applied" });
  else if (database) await database.from("ai_site_proposals").update({ status: "applied", applied_at: new Date().toISOString(), selected_operation_ids: input.selectedOperations }).eq("id", proposal.proposalId).eq("workspace_id", actor.workspaceId);
  return { applied: true, draftOnly: true, selectedOperations: input.selectedOperations, pages: pages.filter((page) => touched.has(page.id)) };
}
