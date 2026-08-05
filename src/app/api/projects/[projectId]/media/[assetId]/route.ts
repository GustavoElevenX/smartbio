import { z } from "zod";
import { deleteMedia, updateMedia } from "@/server/media/media-service";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
const schema = z.object({ altText: z.string().max(500).optional(), tags: z.array(z.string().max(60)).max(20).optional(), assetType: z.string().max(40).optional() });
export const PATCH = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/media/[assetId]">, actor) => { const { projectId, assetId } = await context.params; return Response.json({ data: await updateMedia(actor, projectId, assetId, schema.parse(await request.json())) }); });
export const DELETE = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/media/[assetId]">, actor) => { const { projectId, assetId } = await context.params; return Response.json({ data: await deleteMedia(actor, projectId, assetId, new URL(request.url).searchParams.get("force") === "true") }); });
