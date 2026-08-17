import { z } from "zod";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { getOptimizationState } from "@/server/optimization/optimization-service";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";

const inputSchema = z.object({ suggestionId: z.string().min(1).max(300) });

export const POST = withAuthenticatedActor(async (request, context: { params: Promise<{ projectId: string }> }, actor) => {
  const { projectId } = await context.params;
  const input = inputSchema.parse(await request.json());
  const state = await getOptimizationState(actor, projectId);
  if (!state.evidence?.eligible) return Response.json({ error: "Ainda não há evidência suficiente para uma explicação." }, { status: 409 });
  const suggestion = state.suggestions.find((candidate) => candidate.id === input.suggestionId);
  if (!suggestion) return Response.json({ error: "Sugestão não encontrada ou desatualizada." }, { status: 404 });

  const database = actor.persistence === "database" ? createServiceClient() : null;
  if (database) await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "ai_optimization" });
  if (!isAIConfigured()) return apiSuccess({ explanation: suggestion.explanation, recommendedAction: "Gere uma proposta revisável a partir desta evidência.", usedAI: false });

  const explanation = await getAIProvider().explainOptimization({
    workspaceId: actor.workspaceId,
    projectId,
    userId: actor.userId,
    project: { name: state.project.name, category: state.project.category, audience: state.project.audience, primaryGoal: state.project.primaryGoal },
    suggestion,
  });
  return apiSuccess({ ...explanation, usedAI: true });
});
