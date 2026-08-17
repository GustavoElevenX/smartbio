import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { suggestStructureForActor } from "@/server/site-composer/site-proposal-service";

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/ai/projects/[projectId]/site/suggest-structure">, actor) => {
  const { projectId } = await context.params;
  try { return apiSuccess(await suggestStructureForActor(actor, projectId, await request.json())); }
  catch (error) {
    if (error instanceof ZodError) return validationError(error);
    return apiError(error instanceof Error ? error.message : "Não foi possível criar a proposta.", 400, "site_structure_suggestion_failed");
  }
});
