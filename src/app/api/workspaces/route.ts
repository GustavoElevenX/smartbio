import { cookies } from "next/headers";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { createServiceClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, activeWorkspaceCookieOptions } from "@/server/auth/active-workspace";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") {
    return apiSuccess({ activeWorkspaceId: actor.workspaceId, workspaces: [{ id: actor.workspaceId, name: "Meu workspace", plan: "free", role: actor.role }] });
  }
  const client = createServiceClient();
  if (!client) throw new Error("Supabase não configurado.");
  const { data, error } = await client.from("workspace_members")
    .select("workspace_id,role,workspaces!inner(id,name,plan)")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os workspaces.");
  const workspaces = (data || []).map((membership) => {
    const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
    return { id: workspace.id, name: workspace.name, plan: workspace.plan, role: membership.role };
  });
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, actor.workspaceId, activeWorkspaceCookieOptions());
  return apiSuccess({ activeWorkspaceId: actor.workspaceId, workspaces });
});
