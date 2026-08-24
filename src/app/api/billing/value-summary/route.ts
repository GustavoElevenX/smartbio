import { createServiceClient } from "@/lib/supabase/server";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { buildTrialValueSummary } from "@/features/billing/trial-value-summary";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") return apiSuccess({ periodDays: 7, sessions: 0, opportunities: 0, conversions: 0, confirmedValue: 0 });
  const database = createServiceClient();
  if (!database) return apiSuccess({ periodDays: 7, sessions: 0, opportunities: 0, conversions: 0, confirmedValue: 0 });
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: projects } = await database.from("projects").select("id").eq("workspace_id", actor.workspaceId);
  const projectIds = (projects || []).map((project) => project.id);
  if (!projectIds.length) return apiSuccess({ periodDays: 7, sessions: 0, opportunities: 0, conversions: 0, confirmedValue: 0 });
  const [sessions, opportunities] = await Promise.all([
    database.from("visitor_sessions").select("id", { count: "exact", head: true }).in("project_id", projectIds).gte("started_at", from),
    database.from("commercial_opportunities").select("status,confirmed_value").eq("workspace_id", actor.workspaceId).gte("created_at", from),
  ]);
  if (sessions.error) throw sessions.error;
  if (opportunities.error) throw opportunities.error;
  return apiSuccess(buildTrialValueSummary({ periodDays: 7, sessions: sessions.count || 0, opportunities: opportunities.data || [] }));
});
