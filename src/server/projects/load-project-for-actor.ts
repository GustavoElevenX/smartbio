import "server-only";

import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";
import { loadProjectAggregate } from "@/server/projects/load-project-aggregate";

export async function loadProjectForActor(actor: AuthenticatedActor, projectId: string): Promise<Project | null> {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") return null;
  return loadProjectAggregate(actor, projectId);
}
