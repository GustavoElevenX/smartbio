import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { approveArtwork } from "@/server/visual-engine/visual-service";
export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]/approve">, actor) => {
  const { projectId, artworkId } = await context.params;
  try { return Response.json({ data: await approveArtwork(actor, projectId, artworkId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível aprovar a arte.", 400, "visual_approve_failed"); }
});
