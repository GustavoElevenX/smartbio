import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { requireResourceCapacity } from "@/server/entitlements/require-entitlement";

const schema = z.object({ email: z.email().max(250) });
interface InvitationRouteContext {
  params: Promise<{ workspaceId: string }>;
}

export const GET = withAuthenticatedActor(
  async (_request, context: InvitationRouteContext, actor) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId || actor.role !== "owner")
      return apiError("Acesso negado.", 403, "forbidden");
    if (actor.persistence === "memory") return apiSuccess([]);
    const { data, error } = await createServiceClient()!
      .from("workspace_invitations")
      .select("id,email,role,status,expires_at,created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error)
      return apiError(
        "Não foi possível listar os convites.",
        500,
        "invitations_failed",
      );
    return apiSuccess(data || []);
  },
);

export const POST = withAuthenticatedActor(
  async (request, context: InvitationRouteContext, actor) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId || actor.role !== "owner")
      return apiError("Acesso negado.", 403, "forbidden");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    if (actor.persistence === "memory")
      return apiError(
        "Convites exigem persistência configurada.",
        503,
        "database_required",
      );

    const database = createServiceClient()!;
    const [{ count: members }, { count: pendingInvitations }] =
      await Promise.all([
        database
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
        database
          .from("workspace_invitations")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString()),
      ]);
    await requireResourceCapacity({
      database,
      workspaceId,
      feature: "team_members",
      currentUsage: (members || 0) + (pendingInvitations || 0),
    });
    const email = parsed.data.email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { data: invitation, error } = await database
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        email,
        token_hash: tokenHash,
        invited_by: actor.userId,
        expires_at: expiresAt,
      })
      .select("id,email,role,status,expires_at,created_at")
      .single();
    if (error)
      return apiError(
        "Já existe um convite pendente para este e-mail.",
        409,
        "invitation_exists",
      );

    const origin = new URL(request.url).origin;
    const { error: outboxError } = await database
      .from("notification_outbox")
      .insert({
        workspace_id: workspaceId,
        project_id: null,
        event_key: "workspace.invitation",
        object_type: "workspace_invitation",
        object_id: invitation.id,
        payload: {
          recipientEmail: email,
          acceptanceUrl: `${origin}/invite/${token}`,
        },
      });
    if (outboxError) {
      await database
        .from("workspace_invitations")
        .delete()
        .eq("id", invitation.id);
      return apiError(
        "Não foi possível enfileirar o convite.",
        500,
        "invitation_delivery_failed",
      );
    }
    return apiSuccess(invitation, 201);
  },
);
