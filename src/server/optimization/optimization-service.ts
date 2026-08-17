import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import { demoProjects } from "@/data/demo-projects";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import { getOptimizationEvidenceState } from "@/features/optimization/evidence";
import { buildOptimizationSuggestions } from "@/features/optimization/engine";
import type { AnalyticsEvent } from "@/types";

export async function getOptimizationState(actor: AuthenticatedActor, projectId: string) {
  await assertProjectAccess(actor, projectId, "read");
  const project = actor.persistence === "memory"
    ? demoProjects.find((candidate) => candidate.id === projectId)
    : await loadProjectForActor(actor, projectId);
  if (!project) throw new Error("Projeto não encontrado.");

  const database = actor.persistence === "database" ? createServiceClient() : null;
  const result = database
    ? await database.from("analytics_events").select("id,event_name,session_id,conversion_goal_id,created_at").eq("project_id", projectId).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (result.error) throw new Error("Não foi possível carregar a evidência de performance.");
  const events = (result.data || []).map((row) => ({
    id: String(row.id),
    projectId,
    visitorId: "",
    sessionId: String(row.session_id || row.id),
    eventName: row.event_name,
    conversionGoalId: row.conversion_goal_id ? String(row.conversion_goal_id) : undefined,
    createdAt: String(row.created_at),
  })) as AnalyticsEvent[];
  const sessions = new Set(events.map((event) => event.sessionId)).size;
  const primaryGoal = project.conversionGoals?.find((goal) => goal.isPrimary && goal.isActive) || project.conversionGoals?.find((goal) => goal.isActive);
  const goalSessions = primaryGoal ? new Set(events.filter((event) => event.conversionGoalId === primaryGoal.id).map((event) => event.sessionId)).size : undefined;
  const publishedAt = project.publishedAt;
  const evidence = publishedAt
    ? getOptimizationEvidenceState({ publishedAt, periodStart: publishedAt, periodEnd: new Date().toISOString(), totalSessions: sessions, goalSessions })
    : null;
  const suggestions = evidence?.eligible
    ? buildOptimizationSuggestions(projectId, project.conversionGoals || [], events, publishedAt)
    : [];
  return { project, evidence, suggestions, publishedAt, primaryGoalName: primaryGoal?.name };
}
