import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { loadProjectAggregate } from "@/server/projects/load-project-aggregate";
import { getConversionAnalytics } from "@/server/analytics/service";
import { buildConversionAnalytics } from "@/server/analytics/conversion-analytics";
import type { AnalyticsEvent, CommercialOpportunity } from "@/types";

const viewSchema = z.enum(["overview", "goals", "entries", "destinations", "funnel"]);
export const GET = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string; view: string }> }, actor) => {
  const { projectId, view: rawView } = await context.params; const view = viewSchema.parse(rawView); await assertProjectAccess(actor, projectId, "read");
  if (actor.persistence === "memory") return apiSuccess(null); const supabase = createServiceClient(); if (!supabase) return apiSuccess(null);
  const url = new URL(request.url); const filters = { from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined, goalId: url.searchParams.get("goal") || undefined, entryId: url.searchParams.get("entry") || undefined, destinationId: url.searchParams.get("destination") || undefined, campaign: url.searchParams.get("campaign") || undefined };
  const [rows, project] = await Promise.all([getConversionAnalytics(supabase, projectId, filters), loadProjectAggregate(actor, projectId)]);
  let eventRows = rows.events as Array<Record<string, unknown>>; if (filters.campaign) eventRows = eventRows.filter((row) => (row.metadata as Record<string, unknown> | undefined)?.utm_campaign === filters.campaign);
  const events = eventRows.map((row) => ({ id: String(row.id), projectId, visitorId: "", sessionId: String(row.session_id || ""), eventName: row.event_name, stepId: row.step_id ? String(row.step_id) : undefined, optionId: row.option_id ? String(row.option_id) : undefined, conversionGoalId: row.conversion_goal_id ? String(row.conversion_goal_id) : undefined, entryPointId: row.entry_point_id ? String(row.entry_point_id) : undefined, destinationId: row.destination_id ? String(row.destination_id) : undefined, metadata: row.metadata as Record<string, unknown>, createdAt: String(row.created_at) })) as AnalyticsEvent[];
  const opportunities = (rows.opportunities as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), workspaceId: actor.workspaceId, projectId, sessionId: row.session_id ? String(row.session_id) : undefined, conversionGoalId: row.conversion_goal_id ? String(row.conversion_goal_id) : undefined, entryPointId: row.entry_point_id ? String(row.entry_point_id) : undefined, destinationId: row.destination_id ? String(row.destination_id) : undefined, sourceType: row.source_type, sourceId: String(row.source_id), status: row.status, title: String(row.title), estimatedValue: row.estimated_value == null ? undefined : Number(row.estimated_value), confirmedValue: row.confirmed_value == null ? undefined : Number(row.confirmed_value), currency: String(row.currency), attribution: row.attribution, metadata: row.metadata || {}, createdAt: String(row.created_at), updatedAt: String(row.updated_at) })) as CommercialOpportunity[];
  const analytics = buildConversionAnalytics({ events, opportunities, goals: project?.conversionGoals, entries: project?.entryPoints });
  if (view === "goals") return apiSuccess(analytics.byGoal); if (view === "entries") return apiSuccess(analytics.byEntry); if (view === "funnel") return apiSuccess(analytics.funnel);
  if (view === "destinations") { const ids = [...new Set([...events.map((event) => event.destinationId), ...opportunities.map((item) => item.destinationId)].filter(Boolean))]; return apiSuccess(ids.map((id) => ({ id, actions: new Set(events.filter((event) => event.destinationId === id).map((event) => event.sessionId)).size, opportunities: opportunities.filter((item) => item.destinationId === id).length }))); }
  return apiSuccess(analytics);
});
