import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.mode !== "platform_support") return apiSuccess(null);
  const { data, error } = await createServiceClient()!
    .from("platform_support_sessions")
    .select("id,reason,expires_at,workspace_id,workspaces(name)")
    .eq("id", actor.platform!.supportSessionId!)
    .single();
  if (error)
    return apiError(
      "Não foi possível carregar a sessão de suporte.",
      500,
      "support_session_failed",
    );
  return apiSuccess(data);
});

export const DELETE = withAuthenticatedActor(
  async (request, _context, actor) => {
    if (actor.mode !== "platform_support")
      return apiError("Modo suporte inativo.", 409, "support_not_active");
    const database = createServiceClient()!;
    const endedAt = new Date().toISOString();
    const { data: session, error } = await database
      .from("platform_support_sessions")
      .update({ status: "ended", ended_at: endedAt })
      .eq("id", actor.platform!.supportSessionId!)
      .eq("admin_user_id", actor.platform!.realUserId)
      .eq("status", "active")
      .select("workspace_id,project_id,reason")
      .single();
    if (error)
      return apiError(
        "Não foi possível encerrar o suporte.",
        500,
        "support_end_failed",
      );
    await database
      .from("platform_support_grants")
      .update({ revoked_at: endedAt })
      .eq("support_session_id", actor.platform!.supportSessionId!)
      .is("revoked_at", null);
    await database.from("platform_admin_audit_log").insert({
      admin_user_id: actor.platform!.realUserId,
      admin_role: actor.platform!.role,
      support_session_id: actor.platform!.supportSessionId,
      workspace_id: session.workspace_id,
      project_id: session.project_id,
      action: "support.ended",
      reason: session.reason,
      request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
    });
    (await cookies()).delete("virou_support_session");
    return apiSuccess({ ended: true });
  },
);
