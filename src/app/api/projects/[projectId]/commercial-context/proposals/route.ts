import { z } from "zod";
import { projectCommercialContextSchema } from "@/features/commercial-context/project-commercial-context.schema";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const proposalSchema = z.object({
  proposedContext: projectCommercialContextSchema,
  reason: z.string().trim().min(1).max(500),
  affectedIntentIds: z.array(z.string()).max(100).optional(),
});

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/commercial-context/proposals">, actor) => {
  const { projectId } = await context.params;
  const input = proposalSchema.parse(await request.json());
  return Response.json({ data: await projectCommercialContextService.proposeUpdate(actor, { projectId, ...input }) }, { status: 201 });
});
