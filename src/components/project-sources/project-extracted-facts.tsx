import { ProjectSourceApplyDialog } from "@/components/project-sources/project-source-apply-dialog";
import type { BusinessSource } from "@/types";

export function ProjectExtractedFacts({ projectId, sources }: { projectId: string; sources: BusinessSource[] }) {
  return <ProjectSourceApplyDialog projectId={projectId} sourceIds={sources.filter((source) => source.status === "processed").map((source) => source.id)} />;
}
