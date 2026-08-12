import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const DELETE = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/validators/[validatorId]">, actor) => {
  const { projectId, validatorId } = await context.params;
  await assertProjectAccess(actor, projectId, "write");
  if (actor.role !== "owner") return apiError("Somente owners podem revogar validadores.", 403, "forbidden");
  const database = createServiceClient();
  if (!database) return apiError("Banco não configurado.", 409, "database_required");
  const { error } = await database.from("redemption_validators").update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", validatorId).eq("project_id", projectId).eq("workspace_id", actor.workspaceId);
  if (error) return apiError("Não foi possível revogar o validador.", 500, "validator_revoke_failed");
  return apiSuccess({ revoked: true });
});
