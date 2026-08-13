import { cookies } from "next/headers";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
import { protectAdminMutation } from "@/server/platform-admin/admin-request-security";

const schema = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  reason: z.string().trim().min(5).max(500),
});

export async function POST(request: Request) {
  const admin = await requirePlatformAdmin();
  const blocked = await protectAdminMutation(request, admin.userId);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  const database = createServiceClient()!;
  if (parsed.data.projectId) {
    const { data: project } = await database
      .from("projects")
      .select("workspace_id")
      .eq("id", parsed.data.projectId)
      .maybeSingle();
    if (project?.workspace_id !== parsed.data.workspaceId)
      return apiError(
        "O projeto não pertence ao workspace.",
        409,
        "workspace_project_mismatch",
      );
  }
  const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const { data: session, error } = await database
    .from("platform_support_sessions")
    .insert({
      admin_user_id: admin.userId,
      workspace_id: parsed.data.workspaceId,
      project_id: parsed.data.projectId || null,
      reason: parsed.data.reason,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error)
    return apiError(
      "Não foi possível iniciar o suporte.",
      403,
      "support_start_failed",
    );
  const { error: grantError } = await database
    .from("platform_support_grants")
    .insert({
      support_session_id: session.id,
      admin_user_id: admin.userId,
      workspace_id: parsed.data.workspaceId,
      expires_at: expiresAt,
    });
  if (grantError) {
    await database
      .from("platform_support_sessions")
      .delete()
      .eq("id", session.id);
    return apiError(
      "Não foi possível conceder o acesso de suporte.",
      500,
      "support_grant_failed",
    );
  }
  await database.from("platform_admin_audit_log").insert({
    admin_user_id: admin.userId,
    admin_role: admin.role,
    support_session_id: session.id,
    workspace_id: parsed.data.workspaceId,
    project_id: parsed.data.projectId || null,
    action: "support.started",
    reason: parsed.data.reason,
    request_id: request.headers.get("x-request-id") || crypto.randomUUID(),
  });
  (await cookies()).set("virou_support_session", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return apiSuccess(session, 201);
}
