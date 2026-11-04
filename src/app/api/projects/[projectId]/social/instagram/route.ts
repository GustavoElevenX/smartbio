import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { connectInstagram, disconnectInstagram, instagramStatus } from "@/server/content-studio/social";
import { apiError } from "@/server/http/api-response";
export const runtime = "nodejs";
export const GET = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/social/instagram">, actor) => {
  const { projectId } = await context.params;
  try { return Response.json({ data: await instagramStatus(actor, projectId, new URL(request.url).searchParams.get("state") || undefined) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível consultar o Instagram.", 400, "instagram_status_failed"); }
});
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/social/instagram">, actor) => {
  const { projectId } = await context.params;
  try { return Response.json({ data: await connectInstagram(actor, projectId, new URL(request.url).origin) }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível conectar.", 400, "instagram_connect_failed"); }
});
export const DELETE = withAuthenticatedActor(async (_request, context: RouteContext<"/api/projects/[projectId]/social/instagram">, actor) => {
  const { projectId } = await context.params;
  try { await disconnectInstagram(actor, projectId); return Response.json({ data: { disconnected: true } }); }
  catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível desconectar.", 400, "instagram_disconnect_failed"); }
});
