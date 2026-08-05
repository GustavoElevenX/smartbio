import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import type { Project } from "@/types";

export async function loadProjectForActor(actor: AuthenticatedActor, projectId: string): Promise<Project | null> {
  await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") return null;
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("projects").select("settings").eq("id", projectId).eq("workspace_id", actor.workspaceId).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o projeto.");
  const settings = data?.settings as Record<string, unknown> | undefined;
  return (settings?.projectPayload as Project | undefined) || null;
}
