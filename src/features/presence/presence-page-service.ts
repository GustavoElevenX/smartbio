import type { PresencePage, PresencePageType, PresenceSectionType } from "./presence.types";
import { defaultPresencePageSettings, slugifyPresenceKey } from "./presence-page-utils";
import { presenceSectionRegistry } from "./section-registry";

function id() { return crypto.randomUUID(); }

export function createPresenceSection(pageId: string, type: PresenceSectionType, order = 0) {
  const definition = presenceSectionRegistry[type];
  return {
    id: id(), pageId, key: `${type}-${id().slice(0, 8)}`, type, title: type === "hero" ? "Transforme interesse em ação" : definition.label,
    description: type === "hero" ? "Uma presença clara, confiável e pronta para converter." : definition.description,
    content: structuredClone(definition.defaultContent), style: {}, settings: {}, order, isActive: true,
  } satisfies PresencePage["sections"][number];
}

export function createPresencePage(projectId: string, name: string, type: PresencePageType = "page", existing: PresencePage[] = []): PresencePage {
  const pageId = id();
  const base = slugifyPresenceKey(name);
  let key = base;
  let suffix = 2;
  while (existing.some((page) => page.key === key)) key = `${base}-${suffix++}`;
  const isHome = type === "home" || !existing.length;
  const pageType = isHome ? "home" : type;
  return {
    id: pageId, projectId, key, name, type: pageType, purpose: isHome ? "Apresentar o negócio e conduzir ao objetivo principal." : "Apoiar uma etapa específica da decisão.", path: isHome ? "/" : `/${key}`, title: name, isHome, isActive: true, isIndexable: true, version: 1,
    settings: structuredClone(defaultPresencePageSettings),
    sections: [createPresenceSection(pageId, "hero", 0), createPresenceSection(pageId, "services", 1), createPresenceSection(pageId, "conversion_cta", 2)],
  };
}

export function duplicatePresencePage(page: PresencePage, existing: PresencePage[]) {
  const copy = createPresencePage(page.projectId, `${page.name} — cópia`, page.type === "home" ? "page" : page.type, existing);
  return { ...copy, title: page.title, description: page.description, seoTitle: undefined, seoDescription: undefined, isHome: false, path: `/${copy.key}`, sections: page.sections.map((section, order) => ({ ...structuredClone(section), id: id(), pageId: copy.id, key: `${section.type}-${id().slice(0, 8)}`, order })) };
}
