import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { regenerateCardCopy } from "@/server/content-studio/studio";
import { apiError } from "@/server/http/api-response";
import { consumeRateLimit } from "@/server/rate-limit/rate-limit";
import { z } from "zod";
export const runtime = "nodejs";
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content/[postId]/copy">, actor) => {
  const { projectId, postId } = await context.params; const input = z.object({ slideId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("Card inválido.", 422, "validation_error");
  const rate = await consumeRateLimit("content-copy", actor.userId, { limit: 8, windowMs: 86400000 }, { failClosed: true });
  if (!rate.allowed) return apiError("Limite de reescritas atingido. Edite o card manualmente.", 429, "rate_limited");
  try { return Response.json({ data: await regenerateCardCopy(actor, projectId, postId, input.data.slideId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível reescrever.", 400, "copy_failed"); }
});
