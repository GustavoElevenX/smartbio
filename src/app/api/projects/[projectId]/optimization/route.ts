import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { getOptimizationState } from "@/server/optimization/optimization-service";

export const GET = withAuthenticatedActor(async (_request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params;
  const { evidence, suggestions, publishedAt, primaryGoalName } = await getOptimizationState(actor, projectId);
  return apiSuccess({ evidence, suggestions, publishedAt, primaryGoalName });
});
