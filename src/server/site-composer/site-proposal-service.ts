import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { createPresencePage, createPresenceSection } from "@/features/presence/presence-page-service";
import { applySiteProposalInputSchema, suggestSiteStructureInputSchema } from "@/features/site-composer/site-composer.schema";
import { createSiteStructureProposal, suggestSiteStructure } from "@/features/site-composer/site-structure-suggester";
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
  const pages = structuredClone(project.presence?.pages || []);
  const touched = new Set<string>();
  const deletedByPage = new Map<string, string[]>();
  for (const operation of selected) {
    if (operation.type === "add_page") {
      const page = createPresencePage(projectId, operation.page.name, operation.page.type, pages);
      page.type = operation.page.type;
      page.isHome = operation.page.type === "home";
      page.path = operation.page.pathSuggestion;
      page.purpose = operation.page.purpose;
      page.description = operation.page.purpose;
      page.defaultConversionGoalId = operation.page.conversionGoalId;
      page.sections = operation.page.sections.map((suggested, order) => {
        const section = createPresenceSection(page.id, suggested.sectionType, order);
        return { ...section, title: suggested.purpose, content: { ...section.content, ...suggested.suggestedContent }, settings: { ...section.settings, sourceBindings: suggested.sourceBindings } };
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
      section.settings = { ...section.settings, sourceBindings: operation.section.sourceBindings };
      page.sections.splice(operation.at ?? page.sections.length, 0, section);
      page.sections.forEach((item, order) => { item.order = order; });
    } else if (operation.type === "remove_section") {
      page.sections = page.sections.filter((section) => section.id !== operation.sectionId).map((section, order) => ({ ...section, order }));
      deletedByPage.set(page.id, [...(deletedByPage.get(page.id) || []), operation.sectionId]);
    }
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
    return { page, expectedVersion: original?.version || 0, deletedSectionIds: deletedByPage.get(pageId) || [] };
  }));
  if (actor.persistence === "memory") memoryProposals.set(proposal.proposalId, { ...proposal, status: "applied" });
  else if (database) await database.from("ai_site_proposals").update({ status: "applied", applied_at: new Date().toISOString(), selected_operation_ids: input.selectedOperations }).eq("id", proposal.proposalId).eq("workspace_id", actor.workspaceId);
  return { applied: true, draftOnly: true, selectedOperations: input.selectedOperations, pages: pages.filter((page) => touched.has(page.id)) };
}
