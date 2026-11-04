import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { renderSlide } from "@/server/content-studio/studio";
import { apiError } from "@/server/http/api-response";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content/[postId]/render">, actor) => {
  const { projectId, postId } = await context.params; const slideId = new URL(request.url).searchParams.get("slideId");
  if (!slideId) return apiError("Card não informado.", 422, "validation_error");
  try { const jpeg = await renderSlide(actor, projectId, postId, slideId); return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="sobe-card-${slideId}.jpg"`, "Cache-Control": "private, no-store" } }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível exportar.", 400, "render_failed"); }
});
