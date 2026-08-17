import { ZodError } from "zod";
import { apiError, apiSuccess, validationError } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applySiteProposalForActor, SiteProposalConflictError } from "@/server/site-composer/site-proposal-service";

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/site/apply-proposal">, actor) => {
  const { projectId } = await context.params;
  try { return apiSuccess(await applySiteProposalForActor(actor, projectId, await request.json())); }
  catch (error) {
    if (error instanceof ZodError) return validationError(error);
    if (error instanceof SiteProposalConflictError) return apiError(error.message, 409, "site_proposal_outdated");
    return apiError(error instanceof Error ? error.message : "Não foi possível aplicar a proposta.", 400, "site_proposal_apply_failed");
  }
});
