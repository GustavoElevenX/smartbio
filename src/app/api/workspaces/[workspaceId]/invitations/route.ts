import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { requireResourceCapacity } from "@/server/entitlements/require-entitlement";
import {
  createMemoryWorkspaceInvitation,
  listMemoryWorkspaceInvitations,
} from "@/server/workspaces/workspace-memory-store";
import { processNotificationOutboxBatch } from "@/server/notifications/notification-service";

const schema = z.object({ email: z.email().max(250) });
interface InvitationRouteContext {
  params: Promise<{ workspaceId: string }>;
}

export const GET = withAuthenticatedActor(
  async (_request, context: InvitationRouteContext, actor) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId || actor.role !== "owner")
      return apiError("Acesso negado.", 403, "forbidden");
    if (actor.persistence === "memory")
      return apiSuccess(listMemoryWorkspaceInvitations(actor));
    const database = createServiceClient()!;
    await database
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lte("expires_at", new Date().toISOString());
    const { data, error } = await database
      .from("workspace_invitations")
      .select("id,email,role,status,expires_at,created_at")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
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
    const email = parsed.data.email.trim().toLowerCase();
    const origin = new URL(request.url).origin;
    if (actor.persistence === "memory") {
      const result = createMemoryWorkspaceInvitation(actor, email, origin);
      if ("error" in result) {
        if (result.error === "existing_member")
          return apiError("Este e-mail já pertence ao workspace.", 409, "existing_member");
        return apiError("Já existe um convite pendente para este e-mail.", 409, "invitation_exists");
      }
      return apiSuccess({ ...result.invitation, delivery: "local_link" }, 201);
    }

    const database = createServiceClient()!;
    await database
      .from("workspace_invitations")
      .update({ status: "expired" })
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .lte("expires_at", new Date().toISOString());
    const { data: existingProfile } = await database
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existingProfile) {
      const { data: existingMember } = await database
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();
      if (existingMember)
        return apiError("Este e-mail já pertence ao workspace.", 409, "existing_member");
    }
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
    after(async () => {
      try {
        await processNotificationOutboxBatch(`workspace-invite:${randomUUID()}`, 10);
      } catch (error) {
        console.error("workspace_invitation_delivery_failed", {
          invitationId: invitation.id,
          message: error instanceof Error ? error.message : "Falha ao processar a fila.",
        });
      }
    });
    return apiSuccess({ ...invitation, delivery: "email" }, 201);
  },
);
