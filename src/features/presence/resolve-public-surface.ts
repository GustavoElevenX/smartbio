import type { EntryPoint, Project } from "@/types";
import type { PresencePage, PublicSurfaceMode } from "./presence.types";
import { getPresenceHome } from "./presence-page-utils";
import { projectPublication } from "@/features/publishing/publication-target";

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
  if (!pageKey) {
    const publication = projectPublication(project);
    if (publication.homeMode === "journey") return { mode: "conversion_direct" };
    if (publication.homeMode === "goal") {
      const goal = project.conversionGoals?.find(
        (item) => item.isActive && item.id === publication.conversionGoalId,
      );
      return {
        mode: "conversion_direct",
        conversionGoalId: goal?.id,
        targetStepId: goal?.targetStepId,
      };
    }
    if (publication.homeMode === "step") {
      const step = project.steps.find(
        (item) => item.isActive && item.id === publication.initialStepId,
      );
      return { mode: "conversion_direct", targetStepId: step?.id };
    }
    return { mode: "conversion_direct" };
  }
  const page = explicitPage || getPresenceHome(pages);
  return page ? { mode: page.type === "landing" ? "landing" : "presence", page } : { mode: "conversion_direct" };
}
