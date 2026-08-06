import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiSuccess } from "@/server/http/api-response";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]">, actor) => {
  const { projectId } = await context.params;
  return apiSuccess(await loadProjectForActor(actor, projectId));
});
