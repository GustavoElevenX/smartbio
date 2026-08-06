import { createServiceClient } from "@/lib/supabase/server";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { apiSuccess } from "@/server/http/api-response";
import { loadWorkspaceProjectAggregates } from "@/server/projects/load-project-aggregate";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") return apiSuccess([]);
  const supabase = createServiceClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return apiSuccess(await loadWorkspaceProjectAggregates(supabase, actor.workspaceId));
});
