import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { cancelPublication } from "@/server/content-studio/social";
import { apiError } from "@/server/http/api-response";
export const DELETE = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/content/publications/[publicationId]">, actor) => {
  const { projectId, publicationId } = await context.params;
  try { return Response.json({ data: await cancelPublication(actor, projectId, publicationId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível cancelar.", 400, "cancel_failed"); }
});
