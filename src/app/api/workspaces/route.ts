import { cookies } from "next/headers";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { createServiceClient } from "@/lib/supabase/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieOptions,
} from "@/server/auth/active-workspace";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") {
    return apiSuccess({
      activeWorkspaceId: actor.workspaceId,
      workspaces: [
        {
          id: actor.workspaceId,
          name: "Meu workspace",
          plan: "free",
          role: actor.role,
        },
      ],
    });
  }
  const client = createServiceClient();
  if (!client) throw new Error("Supabase não configurado.");
  const { data: memberships, error } = await client
    .from("workspace_members")
    .select("workspace_id,role,created_at")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os workspaces.");
  const workspaceIds = (memberships || []).map(
    (membership) => membership.workspace_id,
  );
  const [workspaceResult, assignmentResult] = workspaceIds.length
    ? await Promise.all([
        client.from("workspaces").select("id,name,plan").in("id", workspaceIds),
        client
          .from("workspace_plan_assignments")
          .select("workspace_id,plan_key,status")
          .in("workspace_id", workspaceIds)
          .eq("status", "active"),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (workspaceResult.error)
    throw new Error("Não foi possível carregar os workspaces.");
  const workspaceById = new Map(
    (workspaceResult.data || []).map((workspace) => [workspace.id, workspace]),
  );
  const assignmentByWorkspace = new Map(
    (assignmentResult.data || []).map((assignment) => [
      assignment.workspace_id,
      assignment,
    ]),
  );
  const workspaces = (memberships || []).flatMap((membership) => {
    const workspace = workspaceById.get(membership.workspace_id);
    if (!workspace) return [];
    const assignment = assignmentByWorkspace.get(membership.workspace_id);
    return {
      id: workspace.id,
      name: workspace.name,
      plan: assignment?.plan_key || workspace.plan || "free",
      role: membership.role,
    };
  });
  (await cookies()).set(
    ACTIVE_WORKSPACE_COOKIE,
    actor.workspaceId,
    activeWorkspaceCookieOptions(),
  );
  return apiSuccess({ activeWorkspaceId: actor.workspaceId, workspaces });
});
