import type { Project } from "@/types";

export type ProjectPublication = NonNullable<Project["publication"]>;

export function defaultProjectPublication(): ProjectPublication {
  return { homeMode: "journey" };
}

export function projectPublication(project: Project): ProjectPublication {
  return project.publication || defaultProjectPublication();
}

export function projectWithPublication(
  project: Project,
  publication: ProjectPublication,
): Project {
  return {
    ...project,
    publication: {
      homeMode: publication.homeMode,
      ...(publication.homeMode === "goal" && publication.conversionGoalId
        ? { conversionGoalId: publication.conversionGoalId }
        : {}),
      ...(publication.homeMode === "step" && publication.initialStepId
        ? { initialStepId: publication.initialStepId }
        : {}),
    },
  };
}
