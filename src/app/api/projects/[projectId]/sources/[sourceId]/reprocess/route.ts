import { assertProjectAccess } from "@/server/auth/project-access";
import { sourceRepository } from "@/server/business-sources/source-repository";
import { reprocessBusinessSource } from "@/server/business-sources/source-service";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const POST = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/sources/[sourceId]/reprocess">, actor) => {
  const { projectId, sourceId } = await context.params;
  await assertProjectAccess(actor, projectId, "write");
  const source = await sourceRepository.get(actor, sourceId);
  if (!source || source.projectId !== projectId) return apiError("Fonte não encontrada.", 404, "source_not_found");
  return apiSuccess(await reprocessBusinessSource(actor, sourceId));
});
