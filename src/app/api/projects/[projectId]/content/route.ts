import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { createPost, listContentAssets, listPosts, projectContext } from "@/server/content-studio/studio";
import { listPublications } from "@/server/content-studio/social";
import { listMedia } from "@/server/media/media-service";
import { apiError } from "@/server/http/api-response";
import { consumeRateLimit } from "@/server/rate-limit/rate-limit";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/content">, actor) => {
  const { projectId } = await context.params;
  const [business, posts, publications, media, contentAssets] = await Promise.all([projectContext(actor, projectId), listPosts(actor, projectId), listPublications(actor, projectId), listMedia(actor, projectId), listContentAssets(actor, projectId)]);
  return Response.json({ data: { business: { name: business.name, description: business.description, palette: business.palette, context: { offeringContexts: business.context?.offeringContexts.filter(x => x.status === "confirmed").map(x => ({ id: x.id, label: x.label, status: x.status })) || [] } }, posts, publications, media: media.filter(x => ["image/png", "image/jpeg", "image/webp"].includes(x.mimeType)).slice(0, 40), contentAssets } });
});
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content">, actor) => {
  const { projectId } = await context.params;
  const rate = await consumeRateLimit("content-create", actor.userId, { limit: 5, windowMs: 3600000 }, { failClosed: true });
  if (!rate.allowed) return apiError("Aguarde antes de gerar outro conteúdo.", 429, "rate_limited");
  try { return Response.json({ data: await createPost(actor, projectId, await request.json()) }, { status: 201 }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível criar.", 400, "content_create_failed"); }
});
