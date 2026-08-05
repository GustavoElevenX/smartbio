import "server-only";

import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";
import { ProjectNotFoundError, WorkspaceAccessDeniedError } from "@/server/auth/auth-errors";

export type ProjectPermission = "read" | "write" | "delete";

export async function assertProjectAccess(actor: AuthenticatedActor, projectId: string, permission: ProjectPermission = "read") {
  if (actor.persistence === "memory") {
    if (actor.role !== "owner" && permission === "delete") throw new WorkspaceAccessDeniedError("Somente owners podem excluir projetos.");
    return { id: projectId, workspace_id: actor.workspaceId };
  }
  const supabase = createServiceClient();
  if (!supabase) throw new WorkspaceAccessDeniedError();
  const { data } = await supabase.from("projects").select("id,workspace_id").eq("id", projectId).eq("workspace_id", actor.workspaceId).maybeSingle();
  if (!data) throw new ProjectNotFoundError();
  if (permission === "delete" && actor.role !== "owner") throw new WorkspaceAccessDeniedError("Somente owners podem excluir projetos.");
  return data;
}
