import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { editArtwork, getArtwork } from "@/server/visual-engine/visual-service";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]">, actor) => {
  const { projectId, artworkId } = await context.params;
  try { return Response.json({ data: await getArtwork(actor, projectId, artworkId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Arte não encontrada.", 404, "visual_not_found"); }
});
export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]">, actor) => {
  const { projectId, artworkId } = await context.params;
  try { return Response.json({ data: await editArtwork(actor, projectId, artworkId, await request.json()) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível editar a arte.", 400, "visual_edit_failed"); }
});
