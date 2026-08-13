import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { requireResourceCapacity } from "@/server/entitlements/require-entitlement";

interface AcceptInvitationRouteContext {
  params: Promise<{ token: string }>;
}

export const POST = withAuthenticatedActor(
  async (
    _request,
    context: AcceptInvitationRouteContext,
    actor,
  ) => {
    if (actor.persistence === "memory")
      return apiError(
        "Convite indisponível neste modo.",
        503,
        "database_required",
      );
    const { token } = await context.params;
    const database = createServiceClient()!;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: invitation, error } = await database
      .from("workspace_invitations")
      .select("id,workspace_id,email,status,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (
      error ||
      !invitation ||
      invitation.status !== "pending" ||
      new Date(invitation.expires_at) <= new Date() ||
      invitation.email.toLowerCase() !== actor.email.toLowerCase()
    )
      return apiError(
        "Convite inválido ou expirado.",
        410,
        "invalid_invitation",
      );

    await requireResourceCapacity({
      database,
      workspaceId: invitation.workspace_id,
      feature: "team_members",
    });
    const { error: memberError } = await database
      .from("workspace_members")
      .upsert(
        {
          workspace_id: invitation.workspace_id,
          user_id: actor.userId,
          role: "member",
        },
        { onConflict: "workspace_id,user_id" },
      );
    if (memberError)
      return apiError(
        "Não foi possível aceitar o convite.",
        500,
        "invitation_accept_failed",
      );
    await database
      .from("workspace_invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .eq("status", "pending");
    return apiSuccess({ workspaceId: invitation.workspace_id });
  },
);
