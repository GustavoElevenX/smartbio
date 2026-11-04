import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { editPost, getPost } from "@/server/content-studio/studio";
import { apiError } from "@/server/http/api-response";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/content/[postId]">, actor) => {
  const { projectId, postId } = await context.params; return Response.json({ data: await getPost(actor, projectId, postId) });
});
export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content/[postId]">, actor) => {
  const { projectId, postId } = await context.params;
  try { return Response.json({ data: await editPost(actor, projectId, postId, await request.json()) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível salvar.", 400, "content_edit_failed"); }
});
