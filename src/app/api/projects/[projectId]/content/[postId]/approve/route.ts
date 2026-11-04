import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { approvePost } from "@/server/content-studio/studio";
import { apiError } from "@/server/http/api-response";
export const POST = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/content/[postId]/approve">, actor) => {
  const { projectId, postId } = await context.params;
  try { return Response.json({ data: await approvePost(actor, projectId, postId) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível aprovar.", 400, "approval_failed"); }
});
