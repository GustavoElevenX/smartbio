import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { assertProjectAccess } from "@/server/auth/project-access";
import { evaluateOptimizationExperiment } from "@/server/optimization/experiment-evaluation";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { getOptimizationState } from "@/server/optimization/optimization-service";

export const GET = withAuthenticatedActor(async (_request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params;
  const { evidence, suggestions, publishedAt, primaryGoalName } = await getOptimizationState(actor, projectId);
  return apiSuccess({ evidence, suggestions, publishedAt, primaryGoalName });
});

const approvalSchema = z.object({ suggestionId: z.string().min(1).max(300) });

export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params;
  const input = approvalSchema.parse(await request.json());
  await assertProjectAccess(actor, projectId, "write");
  const state = await getOptimizationState(actor, projectId);
  const suggestion = state.suggestions.find((item) => item.id === input.suggestionId);
  if (!suggestion?.proposedChange || !suggestion.targetMetric) throw new Error("Sugestão não está disponível para aprovação.");
  if (actor.persistence === "memory") return apiSuccess({ approved: true, experimentId: undefined });
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  const { data: project } = await database.from("projects").select("published_version_id").eq("id", projectId).eq("workspace_id", actor.workspaceId).single();
  const now = new Date().toISOString();
  const { data: existing } = await database.from("optimization_experiments").select("id,status").eq("project_id", projectId).eq("source_suggestion_key", suggestion.id).not("status", "in", "(dismissed,rolled_back)").maybeSingle();
  if (existing) return apiSuccess({ approved: true, experimentId: existing.id, status: existing.status });
  const { data, error } = await database.from("optimization_experiments").insert({
    workspace_id: actor.workspaceId,
    project_id: projectId,
    source_suggestion_key: suggestion.id,
    suggestion_kind: suggestion.kind,
    change_type: suggestion.proposedChange.changeType,
    proposed_change: suggestion.proposedChange,
    target_metric: suggestion.targetMetric,
    baseline_version_id: project?.published_version_id || null,
    baseline_window_start: state.publishedAt || null,
    baseline_window_end: now,
    risk_level: suggestion.proposedChange.riskLevel,
    status: "approved",
    created_by: actor.userId,
    updated_at: now,
  }).select("id,status").single();
  if (error || !data) throw error || new Error("Não foi possível registrar o experimento.");
  return apiSuccess({ approved: true, experimentId: data.id, status: data.status });
});

const evaluationSchema = z.object({ experimentId: z.string().uuid() });

export const PATCH = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params;
  const input = evaluationSchema.parse(await request.json());
  await assertProjectAccess(actor, projectId, "write");
  if (actor.persistence === "memory") throw new Error("Avaliação requer dados persistidos.");
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  return apiSuccess(await evaluateOptimizationExperiment(database, { workspaceId: actor.workspaceId, projectId, experimentId: input.experimentId }));
});
