import type { PresenceAction, PresencePage, PresenceSection } from "./presence.types";

export const defaultPresencePageSettings: PresencePage["settings"] = {
  header: { enabled: true, sticky: true, showLogo: true, showNavigation: true },
  footer: { enabled: true, showLogo: true, showSocialLinks: true, showPolicies: true, showVirouBranding: true },
  layout: { maxWidth: "xl", sectionSpacing: "normal" },
  conversionPresentation: { mode: "overlay" },
};

export function getPresenceHome(pages: PresencePage[] | undefined) {
  return pages?.find((page) => page.isHome && page.isActive);
}

export function getPresencePage(pages: PresencePage[] | undefined, key?: string) {
  return key ? pages?.find((page) => page.key === key && page.isActive) : getPresenceHome(pages);
}

export function getSectionActions(section: PresenceSection): PresenceAction[] {
  const content = section.content as { primaryAction?: PresenceAction; secondaryAction?: PresenceAction; action?: PresenceAction; nearestAction?: PresenceAction; itemAction?: PresenceAction };
  return [content.primaryAction, content.secondaryAction, content.action, content.nearestAction, content.itemAction].filter((action): action is PresenceAction => Boolean(action));
}

export function slugifyPresenceKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "pagina";
}
