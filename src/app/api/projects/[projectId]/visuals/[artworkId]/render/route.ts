import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { renderArtwork } from "@/server/visual-engine/visual-service";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]/render">, actor) => {
  const { projectId, artworkId } = await context.params;
  try {
    const png = await renderArtwork(actor, projectId, artworkId);
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="sobe-arte-${artworkId}.png"` } });
  } catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível renderizar a arte.", 400, "visual_render_failed"); }
});
