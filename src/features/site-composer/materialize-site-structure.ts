import { createPresencePage, createPresenceSection } from "@/features/presence/presence-page-service";
import type { PresenceAction, PresencePage, PresenceSection } from "@/features/presence/presence.types";
import { createSiteStructureProposal } from "@/features/site-composer/site-structure-suggester";
import type { SiteOperation, SuggestedSiteStructure } from "@/features/site-composer/site-composer.types";
import type { Project } from "@/types";

export interface SiteMaterializationResult {
  project: Project;
  touchedPageIds: string[];
  deletedSectionIds: Record<string, string[]>;
}

function stableUuid(value: string) {
  const hashes = [2166136261, 2246822519, 3266489917, 668265263];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    for (let hashIndex = 0; hashIndex < hashes.length; hashIndex += 1) {
      hashes[hashIndex] ^= code + hashIndex * 31;
      hashes[hashIndex] = Math.imul(hashes[hashIndex], 16777619 + hashIndex * 2) >>> 0;
    }
  }
  const hex = hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function deterministicPage(project: Project, operation: Extract<SiteOperation, { type: "add_page" }>, pages: PresencePage[]) {
  const page = createPresencePage(project.id, operation.page.name, operation.page.type, pages);
  const pageId = stableUuid(`${project.id}:page:${operation.page.pathSuggestion}:${operation.page.name}`);
  page.id = pageId;
  page.key = operation.page.pathSuggestion === "/" ? "inicio" : operation.page.pathSuggestion.slice(1).replaceAll("/", "-") || page.key;
  page.type = operation.page.type;
  page.isHome = operation.page.type === "home";
  page.path = operation.page.pathSuggestion;
  page.purpose = operation.page.purpose;
  page.title = operation.page.name;
  page.description = operation.page.purpose;
  page.sections = operation.page.sections.map((suggested, order) => {
    const section = createPresenceSection(pageId, suggested.sectionType, order);
    const sectionId = stableUuid(`${project.id}:${pageId}:${suggested.sectionType}:${order}`);
    return {
      ...section,
      id: sectionId,
      pageId,
      key: `${suggested.sectionType}-${sectionId.slice(0, 8)}`,
      title: suggested.title || suggested.purpose,
      description: suggested.description || section.description,
      content: { ...section.content, ...suggested.suggestedContent },
      settings: { ...section.settings, sourceBindings: suggested.sourceBindings },
    };
  });
  return page;
}

function validAction(action: unknown, goalIds: Set<string>) {
  if (!action || typeof action !== "object") return action;
  const candidate = action as PresenceAction;
  if (candidate.type === "start_conversion_goal" && (!candidate.conversionGoalId || !goalIds.has(candidate.conversionGoalId))) return undefined;
  return candidate;
}

function sanitizeSection(section: PresenceSection, fallbackGoalId: string | undefined, goalIds: Set<string>) {
  const content = { ...section.content } as Record<string, unknown>;
  for (const key of ["primaryAction", "secondaryAction", "action", "itemAction", "nearestAction"]) {
    const action = validAction(content[key], goalIds);
    if (action) content[key] = action;
    else delete content[key];
  }
  if (typeof content.itemGoalId === "string" && !goalIds.has(content.itemGoalId)) delete content.itemGoalId;
  if (section.type === "conversion_cta" && !content.primaryAction && fallbackGoalId) {
    content.primaryAction = {
      type: "start_conversion_goal",
      label: "Continuar",
      conversionGoalId: fallbackGoalId,
      style: "primary",
    } satisfies PresenceAction;
  }
  return { ...section, content };
}

export function applySiteOperationsToDraft(project: Project, operations: SiteOperation[]): SiteMaterializationResult {
  const next = structuredClone(project);
  const pages = next.presence?.pages || [];
  const touched = new Set<string>();
  const deletedByPage = new Map<string, string[]>();
  const goalIds = new Set((next.conversionGoals || []).filter((goal) => goal.isActive).map((goal) => goal.id));
  const primaryGoalId = next.conversionGoals?.find((goal) => goal.isPrimary && goal.isActive)?.id || next.conversionGoals?.find((goal) => goal.isActive)?.id;

  for (const operation of operations) {
    if (operation.type === "add_page") {
      const page = deterministicPage(next, operation, pages);
      page.defaultConversionGoalId = operation.page.conversionGoalId && goalIds.has(operation.page.conversionGoalId)
        ? operation.page.conversionGoalId
        : primaryGoalId;
      pages.push(page);
      touched.add(page.id);
      continue;
    }
    const page = pages.find((candidate) => candidate.id === operation.pageId);
    if (!page) continue;
    touched.add(page.id);
    if (operation.type === "add_section") {
      const at = operation.at ?? page.sections.length;
      const section = createPresenceSection(page.id, operation.section.sectionType, at);
      const sectionId = stableUuid(`${next.id}:${page.id}:${operation.section.sectionType}:${at}:${operation.id}`);
      page.sections.splice(at, 0, {
        ...section,
        id: sectionId,
        key: `${operation.section.sectionType}-${sectionId.slice(0, 8)}`,
        title: operation.section.title || operation.section.purpose,
        description: operation.section.description || section.description,
        content: { ...section.content, ...operation.section.suggestedContent },
        settings: { ...section.settings, sourceBindings: operation.section.sourceBindings },
      });
    } else if (operation.type === "remove_section") {
      page.sections = page.sections.filter((section) => section.id !== operation.sectionId);
      deletedByPage.set(page.id, [...(deletedByPage.get(page.id) || []), operation.sectionId]);
    } else if (operation.type === "move_section") {
      const index = page.sections.findIndex((section) => section.id === operation.sectionId);
      if (index >= 0) page.sections.splice(operation.to, 0, page.sections.splice(index, 1)[0]);
    } else if (operation.type === "rename_page") {
      page.name = operation.name;
    } else if (operation.type === "connect_goal") {
      if (goalIds.has(operation.conversionGoalId)) page.defaultConversionGoalId = operation.conversionGoalId;
    } else if (operation.type === "update_section") {
      const index = page.sections.findIndex((section) => section.id === operation.sectionId);
      if (index >= 0) page.sections[index] = { ...page.sections[index], ...operation.patch };
    }
    page.sections = page.sections.map((section, order) => ({ ...section, order }));
  }

  for (const page of pages) {
    if (page.defaultConversionGoalId && !goalIds.has(page.defaultConversionGoalId)) page.defaultConversionGoalId = primaryGoalId;
    page.sections = page.sections.map((section) => sanitizeSection(section, page.defaultConversionGoalId || primaryGoalId, goalIds));
  }
  next.presence = { pages };
  return {
    project: next,
    touchedPageIds: [...touched],
    deletedSectionIds: Object.fromEntries(deletedByPage),
  };
}

export function materializeSuggestedSiteStructure(project: Project, suggestion: SuggestedSiteStructure) {
  const operations = createSiteStructureProposal(project, "site", "", undefined, suggestion).operations;
  return applySiteOperationsToDraft(project, operations);
}
