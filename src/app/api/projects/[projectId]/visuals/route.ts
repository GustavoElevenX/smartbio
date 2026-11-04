import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { consumeRateLimit } from "@/server/rate-limit/rate-limit";
import { createArtworks, getDesignKit, listArtworks } from "@/server/visual-engine/visual-service";
import { listMedia } from "@/server/media/media-service";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/visuals">, actor) => {
  const { projectId } = await context.params;
  const [kit, artworks, media, project] = await Promise.all([getDesignKit(actor, projectId), listArtworks(actor, projectId), listMedia(actor, projectId), loadProjectForActor(actor, projectId)]);
  return Response.json({ data: { kit, artworks, media: media.filter(item => ["image/png", "image/jpeg", "image/webp"].includes(item.mimeType)).slice(0, 60), pages: project?.presence?.pages.map(page => ({ id: page.id, name: page.name, hasHero: page.sections.some(section => section.type === "hero") })) || [] } });
});
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/visuals">, actor) => {
  const { projectId } = await context.params;
  const rate = await consumeRateLimit("visual-create", actor.userId, { limit: 12, windowMs: 3600000 }, { failClosed: true });
  if (!rate.allowed) return apiError("Aguarde antes de criar mais alternativas.", 429, "rate_limited");
  try { return Response.json({ data: await createArtworks(actor, projectId, await request.json()) }, { status: 201 }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível criar as artes.", 400, "visual_create_failed"); }
});
