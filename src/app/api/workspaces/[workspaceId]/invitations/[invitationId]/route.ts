import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { revokeMemoryWorkspaceInvitation } from "@/server/workspaces/workspace-memory-store";

export const DELETE = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/workspaces/[workspaceId]/invitations/[invitationId]">,
    actor,
  ) => {
    const { workspaceId, invitationId } = await context.params;
    if (workspaceId !== actor.workspaceId || actor.role !== "owner")
      return apiError("Somente o proprietário pode cancelar convites.", 403, "forbidden");
    if (actor.persistence === "memory") {
      return revokeMemoryWorkspaceInvitation(actor, invitationId)
        ? apiSuccess({ revoked: true })
        : apiError("Convite não encontrado.", 404, "invitation_not_found");
    }
    const { data, error } = await createServiceClient()!
      .from("workspace_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error)
      return apiError("Não foi possível cancelar o convite.", 500, "invitation_revoke_failed");
    if (!data)
      return apiError("Convite não encontrado.", 404, "invitation_not_found");
    return apiSuccess({ revoked: true });
  },
);
