import { presencePageSchema } from "@/features/presence/presence-page.schema";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { savePresencePageForActor } from "@/server/presence/presence-page-service";

export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/presence">, actor) => {
  const { projectId } = await context.params; const project = await loadProjectForActor(actor, projectId);
  return Response.json({ data: project?.presence || { pages: [] } });
});

export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/presence">, actor) => {
  const { projectId } = await context.params;
  const page = presencePageSchema.parse(await request.json());
  return Response.json({ data: await savePresencePageForActor(actor, projectId, { page, expectedVersion: 0, deletedSectionIds: [] }) }, { status: 201 });
});
