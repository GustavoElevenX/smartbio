import { ZodError } from "zod";
import { CommercialDataConflictError, saveCommercialData } from "@/server/commercial-data/commercial-data-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/commercial-data">, actor) => {
  const { projectId } = await context.params;
  try {
    const result = await saveCommercialData(actor, projectId, await request.json());
    return Response.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Dados comerciais inválidos.", issues: error.issues }, { status: 422 });
    if (error instanceof CommercialDataConflictError) return Response.json({ error: error.message, code: "project_version_conflict" }, { status: 409 });
    throw error;
  }
});
