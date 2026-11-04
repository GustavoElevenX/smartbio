import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { queuePublication, processPublications } from "@/server/content-studio/social";
import { apiError } from "@/server/http/api-response";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({ connectionId: z.string().uuid(), scheduledAt: z.iso.datetime().optional() });
export const POST = withAuthenticatedActor(async (request, context: RouteContext<"/api/projects/[projectId]/content/[postId]/publish">, actor) => {
  const { projectId, postId } = await context.params; const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return apiError("Dados de publicação inválidos.", 422, "validation_error");
  try {
    const queued = await queuePublication(actor, projectId, postId, input.data.connectionId, input.data.scheduledAt);
    if (!input.data.scheduledAt && queued?.status === "queued") await processPublications(`immediate:${crypto.randomUUID()}`, 1, queued.id);
    const { createServiceClient } = await import("@/lib/supabase/server");
    const current = await createServiceClient()?.from("social_publications").select("*").eq("id", queued.id).eq("workspace_id", actor.workspaceId).eq("project_id", projectId).single();
    return Response.json({ data: current?.data || queued });
  } catch (error) { return apiError(error instanceof Error ? error.message : "Não foi possível publicar.", 400, "publication_failed"); }
});
