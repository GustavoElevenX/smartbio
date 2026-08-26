import { z } from "zod";
import { CommercialContextRevisionConflictError } from "@/server/commercial-context/project-commercial-context-repository";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const decisionSchema = z.object({ decision: z.enum(["accept", "reject"]) });

export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/commercial-context/proposals/[proposalId]">, actor) => {
  const { projectId, proposalId } = await context.params;
  const input = decisionSchema.parse(await request.json());
  try {
    const data = input.decision === "accept"
      ? await projectCommercialContextService.acceptProposal(actor, projectId, proposalId)
      : await projectCommercialContextService.rejectProposal(actor, projectId, proposalId);
    return Response.json({ data });
  } catch (error) {
    if (error instanceof CommercialContextRevisionConflictError) return Response.json({ error: error.message, code: "commercial_context_revision_conflict" }, { status: 409 });
    throw error;
  }
});
