import { z, ZodError } from "zod";
import { CommercialContextRevisionConflictError } from "@/server/commercial-context/project-commercial-context-repository";
import { projectCommercialContextService } from "@/server/commercial-context/project-commercial-context-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const updateSchema = z.object({ expectedRevision: z.number().int().min(1), context: z.unknown() });

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/commercial-context">, actor) => {
  const { projectId } = await context.params;
  return Response.json({ data: await projectCommercialContextService.get(actor, projectId) });
});

export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/commercial-context">, actor) => {
  const { projectId } = await context.params;
  try {
    const input = updateSchema.parse(await request.json());
    return Response.json({ data: await projectCommercialContextService.updateFromUser(actor, projectId, input.context, input.expectedRevision) });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Contexto comercial inválido.", issues: error.issues }, { status: 422 });
    if (error instanceof CommercialContextRevisionConflictError) return Response.json({ error: error.message, code: "commercial_context_revision_conflict" }, { status: 409 });
    throw error;
  }
});
