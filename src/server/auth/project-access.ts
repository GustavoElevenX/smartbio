import "server-only";

import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ProjectNotFoundError,
  WorkspaceAccessDeniedError,
} from "@/server/auth/auth-errors";

export type ProjectPermission = "read" | "write" | "delete";

export async function assertProjectAccess(
  actor: AuthenticatedActor,
  projectId: string,
  permission: ProjectPermission = "read",
) {
  if (actor.persistence === "memory") {
    if (actor.role !== "owner" && permission === "delete")
      throw new WorkspaceAccessDeniedError(
        "Somente owners podem excluir projetos.",
      );
    return { id: projectId, workspace_id: actor.workspaceId };
  }
  const supabase = createServiceClient();
  if (!supabase) throw new WorkspaceAccessDeniedError();
  if (actor.mode === "platform_support") {
    const { data: session } = await supabase
      .from("platform_support_sessions")
      .select("project_id,status,expires_at")
      .eq("id", actor.platform!.supportSessionId!)
      .eq("admin_user_id", actor.platform!.realUserId)
      .eq("workspace_id", actor.workspaceId)
      .maybeSingle();
    const { data: grant } = await supabase
      .from("platform_support_grants")
      .select("can_write,revoked_at,expires_at")
      .eq("support_session_id", actor.platform!.supportSessionId!)
      .eq("admin_user_id", actor.platform!.realUserId)
      .eq("workspace_id", actor.workspaceId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (
      !session ||
      !grant ||
      session.status !== "active" ||
      new Date(session.expires_at) <= new Date() ||
      (session.project_id && session.project_id !== projectId) ||
      permission === "delete" ||
      (permission === "write" && !grant.can_write)
    )
      throw new WorkspaceAccessDeniedError(
        "A sessão de suporte não permite esta operação.",
      );
  }
  const { data } = await supabase
    .from("projects")
    .select("id,workspace_id")
    .eq("id", projectId)
    .eq("workspace_id", actor.workspaceId)
    .maybeSingle();
  if (!data) throw new ProjectNotFoundError();
  if (permission === "delete" && actor.role !== "owner")
    throw new WorkspaceAccessDeniedError(
      "Somente owners podem excluir projetos.",
    );
  return data;
}
