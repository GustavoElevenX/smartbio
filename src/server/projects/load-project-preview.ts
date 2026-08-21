import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import type { Project } from "@/types";

export async function loadProjectPreviewBySlug(
  actor: AuthenticatedActor,
  slug: string,
): Promise<Project | null> {
  if (actor.persistence === "memory") return null;

  const database = createServiceClient();
  if (!database) return null;

  const { data, error } = await database
    .from("projects")
    .select("id")
    .eq("workspace_id", actor.workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (error)
    throw new Error("Não foi possível localizar o projeto para prévia.");
  if (!data?.id) return null;

  return loadProjectForActor(actor, String(data.id));
}
