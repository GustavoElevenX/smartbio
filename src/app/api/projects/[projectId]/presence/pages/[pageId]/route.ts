import { ZodError } from "zod";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { PresenceSaveConflictError, deletePresencePageForActor, savePresencePageForActor } from "@/server/presence/presence-page-service";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/presence/pages/[pageId]">, actor) => {
  const { projectId, pageId } = await context.params;
  const project = await loadProjectForActor(actor, projectId);
  const page = project?.presence?.pages.find((item) => item.id === pageId);
  return page ? Response.json({ data: page }) : Response.json({ error: "Página não encontrada." }, { status: 404 });
});

export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/presence/pages/[pageId]">, actor) => {
  const { projectId, pageId } = await context.params;
  try {
    const input = await request.json() as { page?: { id?: string } };
    if (input.page?.id !== pageId) return Response.json({ error: "Identificador de página inconsistente." }, { status: 400 });
    return Response.json({ data: await savePresencePageForActor(actor, projectId, input) });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Página inválida.", issues: error.issues }, { status: 422 });
    if (error instanceof PresenceSaveConflictError) return Response.json({ error: error.message, code: "presence_page_version_conflict" }, { status: 409 });
    throw error;
  }
});

export const DELETE = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/presence/pages/[pageId]">, actor) => {
  const { projectId, pageId } = await context.params;
  await deletePresencePageForActor(actor, projectId, pageId);
  return Response.json({ data: { deleted: true } });
});
