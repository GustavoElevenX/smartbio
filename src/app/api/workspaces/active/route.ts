import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE, activeWorkspaceCookieOptions } from "@/server/auth/active-workspace";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const schema = z.object({ workspaceId: z.uuid() });

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationError(parsed.error);
  if (actor.persistence === "memory") {
    if (parsed.data.workspaceId !== actor.workspaceId) return apiError("Você não participa deste workspace.", 403, "workspace_access_denied");
  } else {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase não configurado.");
    const { data } = await client.from("workspace_members")
      .select("workspace_id,role,workspaces!inner(id,name,plan)")
      .eq("workspace_id", parsed.data.workspaceId)
      .eq("user_id", actor.userId)
      .maybeSingle();
    if (!data) return apiError("Você não participa deste workspace.", 403, "workspace_access_denied");
    await client.from("profiles").update({ last_workspace_id: parsed.data.workspaceId }).eq("id", actor.userId);
  }
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, parsed.data.workspaceId, activeWorkspaceCookieOptions());
  revalidatePath("/app", "layout");
  return apiSuccess({ workspaceId: parsed.data.workspaceId });
});
