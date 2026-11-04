import { z } from "zod";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { applyArtworkToPage } from "@/server/visual-engine/visual-service";
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]/apply">, actor) => {
  const { projectId, artworkId } = await context.params;
  const parsed = z.object({ pageId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Selecione uma página válida.", 422, "validation_error");
  try { return Response.json({ data: await applyArtworkToPage(actor, projectId, artworkId, parsed.data.pageId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível aplicar a arte.", 400, "visual_apply_failed"); }
});
