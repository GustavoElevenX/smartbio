import { mediaUsage } from "@/server/media/media-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
export const GET = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/media/[assetId]/usage">, actor) => { const { projectId, assetId } = await context.params; return Response.json({ data: await mediaUsage(actor, projectId, assetId) }); });
