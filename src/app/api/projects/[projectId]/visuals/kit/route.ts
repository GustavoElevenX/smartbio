import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { updateDesignKit } from "@/server/visual-engine/visual-service";
export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/visuals/kit">, actor) => {
  const { projectId } = await context.params;
  try { return Response.json({ data: await updateDesignKit(actor, projectId, await request.json()) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível salvar o Design Kit.", 400, "visual_kit_failed"); }
});
