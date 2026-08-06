import { sourceRepository } from "@/server/business-sources/source-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { apiSuccess } from "@/server/http/api-response";

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/sources">, actor) => {
  const { projectId } = await context.params;
  await assertProjectAccess(actor, projectId, "read");
  return apiSuccess(await sourceRepository.list(actor, projectId));
});
