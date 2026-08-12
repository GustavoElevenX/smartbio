import type { EntryPoint, Project } from "@/types";
import type { PresencePage, PublicSurfaceMode } from "./presence.types";
import { getPresenceHome } from "./presence-page-utils";

export interface ResolvedPublicSurface {
  mode: PublicSurfaceMode;
  page?: PresencePage;
  entry?: EntryPoint;
  conversionGoalId?: string;
  targetStepId?: string;
}

export function resolvePublicSurface(project: Project, entryKey?: string | null, pageKey?: string | null): ResolvedPublicSurface {
  const pages = project.presence?.pages || [];
  const entry = entryKey ? project.entryPoints?.find((item) => item.isActive && item.key === entryKey) : undefined;
  const explicitPage = pageKey ? pages.find((page) => page.isActive && page.key === pageKey) : undefined;
  if (entry) {
    const legacyDirect = !entry.surfaceMode || (entry.surfaceMode === "presence" && !entry.presencePageId && Boolean(entry.conversionGoalId || entry.targetStepId));
    if (legacyDirect || entry.surfaceMode === "conversion_direct") return { mode: "conversion_direct", entry, conversionGoalId: entry.conversionGoalId, targetStepId: entry.targetStepId };
    const page = pages.find((item) => item.isActive && item.id === entry.presencePageId) || explicitPage || getPresenceHome(pages);
    return { mode: entry.surfaceMode === "landing" ? "landing" : "presence", page, entry, conversionGoalId: entry.conversionGoalId, targetStepId: entry.targetStepId };
  }
  const page = explicitPage || getPresenceHome(pages);
  return page ? { mode: page.type === "landing" ? "landing" : "presence", page } : { mode: "conversion_direct" };
}
