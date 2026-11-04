import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiError } from "@/server/http/api-response";
import { consumeRateLimit } from "@/server/rate-limit/rate-limit";
import { generateArtworkImage } from "@/server/visual-engine/visual-service";
export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/visuals/[artworkId]/image">, actor) => {
  const { projectId, artworkId } = await context.params;
  const rate = await consumeRateLimit("visual-image", actor.userId, { limit: 4, windowMs: 3600000 }, { failClosed: true });
  if (!rate.allowed) return apiError("Aguarde antes de gerar outra imagem.", 429, "rate_limited");
  try { return Response.json({ data: await generateArtworkImage(actor, projectId, artworkId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível gerar a imagem.", 400, "visual_image_failed"); }
});
