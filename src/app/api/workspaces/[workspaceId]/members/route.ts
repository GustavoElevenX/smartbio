import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { listMemoryWorkspaceMembers } from "@/server/workspaces/workspace-memory-store";

export const GET = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/workspaces/[workspaceId]/members">,
    actor,
  ) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId)
      return apiError("Acesso negado.", 403, "workspace_access_denied");
    if (actor.persistence === "memory") {
      return apiSuccess(listMemoryWorkspaceMembers(actor));
    }
    const { data, error } = await createServiceClient()!
      .from("workspace_members")
      .select("user_id,role,created_at,profiles(full_name,email,avatar_url)")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    if (error)
      return apiError(
        "Não foi possível listar membros.",
        500,
        "members_failed",
      );
    return apiSuccess((data || []).map((member) =>
      member.user_id === actor.userId
        ? {
            ...member,
            profiles: (member.profiles.length
              ? member.profiles
              : [{ full_name: null, email: null, avatar_url: null }]
            ).map((profile) => ({ ...profile, email: profile.email || actor.email })),
          }
        : member,
    ));
  },
);
