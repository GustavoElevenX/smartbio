import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { generateImage } from "@/server/content-studio/studio";
import { apiError } from "@/server/http/api-response";
import { z } from "zod";
import { consumeRateLimit } from "@/server/rate-limit/rate-limit";
export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content/[postId]/image">, actor) => {
  const { projectId, postId } = await context.params;
  const parsed = z.object({ slideId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Card inválido.", 422, "validation_error");
  const rate = await consumeRateLimit("content-image", actor.userId, { limit: 4, windowMs: 3600000 }, { failClosed: true });
  if (!rate.allowed) return apiError("Aguarde antes de gerar outra imagem.", 429, "rate_limited");
  try { return Response.json({ data: await generateImage(actor, projectId, postId, parsed.data.slideId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível gerar a imagem.", 400, "image_generation_failed"); }
});
