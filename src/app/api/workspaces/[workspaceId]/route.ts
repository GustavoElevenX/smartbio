import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  apiError,
  apiSuccess,
  validationError,
} from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import {
  getMemoryWorkspace,
  updateMemoryWorkspace,
} from "@/server/workspaces/workspace-memory-store";

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80)
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withAuthenticatedActor(
  async (
    _request,
    context: RouteContext<"/api/workspaces/[workspaceId]">,
    actor,
  ) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId)
      return apiError("Acesso negado.", 403, "workspace_access_denied");
    if (actor.persistence === "memory") {
      return apiSuccess(getMemoryWorkspace(actor));
    }
    const { data, error } = await createServiceClient()!
      .from("workspaces")
      .select("id,name,slug,settings,account_status,created_at,updated_at")
      .eq("id", workspaceId)
      .single();
    if (error) return apiError("Workspace não encontrado.", 404, "not_found");
    return apiSuccess(data);
  },
);

export const PATCH = withAuthenticatedActor(
  async (
    request,
    context: RouteContext<"/api/workspaces/[workspaceId]">,
    actor,
  ) => {
    const { workspaceId } = await context.params;
    if (workspaceId !== actor.workspaceId || actor.role !== "owner")
      return apiError(
        "Somente o owner pode alterar o workspace.",
        403,
        "forbidden",
      );
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    if (actor.persistence === "memory") {
      return apiSuccess(updateMemoryWorkspace(actor, parsed.data));
    }
    const { data, error } = await createServiceClient()!
      .from("workspaces")
      .update(parsed.data)
      .eq("id", workspaceId)
      .select("id,name,slug,settings,account_status")
      .single();
    if (error?.code === "23505")
      return apiError(
        "Este identificador já está sendo usado por outro workspace.",
        409,
        "workspace_slug_exists",
      );
    if (error)
      return apiError(
        "Não foi possível atualizar o workspace.",
        500,
        "workspace_update_failed",
      );
    return apiSuccess(data);
  },
);
