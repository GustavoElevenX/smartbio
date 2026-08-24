import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTION_EVENT_NAMES } from "@/features/optimization/config";
import { evaluateObservationalChange, type EvaluationMetrics } from "@/features/optimization/evaluation";

type MetricName = "intention_rate" | "action_rate" | "opportunity_rate" | "conversion_rate" | "confirmed_value_per_session";

async function metricsForVersion(database: SupabaseClient, projectId: string, versionId: string, metric: MetricName): Promise<EvaluationMetrics> {
  const [events, opportunities] = await Promise.all([
    database.from("analytics_events").select("session_id,event_name").eq("project_id", projectId).eq("project_version_id", versionId),
    database.from("commercial_opportunities").select("status,confirmed_value").eq("project_id", projectId).eq("project_version_id", versionId),
  ]);
  if (events.error) throw events.error;
  if (opportunities.error) throw opportunities.error;
  const rows = events.data || [];
  const sessions = new Set(rows.map((row) => row.session_id).filter(Boolean)).size;
  const intentions = new Set(rows.filter((row) => ["conversion_goal_selected", "conversion_goal_resolved"].includes(row.event_name)).map((row) => row.session_id).filter(Boolean)).size;
  const actions = new Set(rows.filter((row) => (ACTION_EVENT_NAMES as readonly string[]).includes(row.event_name)).map((row) => row.session_id).filter(Boolean)).size;
  const conversions = (opportunities.data || []).filter((row) => row.status === "converted");
  const confirmedValue = conversions.reduce((total, row) => total + Number(row.confirmed_value || 0), 0);
  const numerator = metric === "intention_rate" ? intentions : metric === "action_rate" ? actions : metric === "opportunity_rate" ? (opportunities.data || []).length : metric === "conversion_rate" ? conversions.length : confirmedValue;
  return { sessions, opportunities: (opportunities.data || []).length, conversions: conversions.length, confirmedValue, rate: sessions ? numerator / sessions : 0 };
}

export async function evaluateOptimizationExperiment(database: SupabaseClient, input: { workspaceId: string; projectId: string; experimentId: string }) {
  const { data: experiment, error } = await database.from("optimization_experiments").select("id,target_metric,baseline_version_id,candidate_version_id,status").eq("id", input.experimentId).eq("project_id", input.projectId).eq("workspace_id", input.workspaceId).single();
  if (error || !experiment) throw error || new Error("Experimento não encontrado.");
  if (!experiment.baseline_version_id || !experiment.candidate_version_id) throw new Error("O experimento ainda não possui as duas versões publicadas.");
  const metric = experiment.target_metric as MetricName;
  const [baseline, candidate] = await Promise.all([
    metricsForVersion(database, input.projectId, experiment.baseline_version_id, metric),
    metricsForVersion(database, input.projectId, experiment.candidate_version_id, metric),
  ]);
  const evaluation = evaluateObservationalChange(baseline, candidate);
  const now = new Date().toISOString();
  const { error: updateError } = await database.from("optimization_experiments").update({
    baseline_metrics: baseline,
    candidate_metrics: candidate,
    delta_metrics: { absolute: evaluation.absoluteDelta, relative: evaluation.relativeDelta },
    result: evaluation.result,
    status: evaluation.result === "insufficient" ? "collecting" : "evaluated",
    candidate_window_end: now,
    evaluated_at: now,
    updated_at: now,
  }).eq("id", experiment.id);
  if (updateError) throw updateError;
  return { baseline, candidate, ...evaluation, status: evaluation.result === "insufficient" ? "collecting" as const : "evaluated" as const };
}
