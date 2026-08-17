import type { OptimizationSuggestion } from "@/types";
import { hasEnoughEvidence } from "./evidence";
export function goalDropoffRule(input: { projectId: string; goalId: string; goalName: string; publishedAt?: string; periodStart?: string; periodEnd?: string; totalSessions: number; goalSessions: number; actionSessions: number }): OptimizationSuggestion | null {
  if (input.publishedAt && input.periodStart && input.periodEnd ? !hasEnoughEvidence({ ...input, publishedAt: input.publishedAt, periodStart: input.periodStart, periodEnd: input.periodEnd }) : !hasEnoughEvidence(input.totalSessions, input.goalSessions)) return null;
  const rate = input.goalSessions ? input.actionSessions / input.goalSessions : 0; if (rate >= 0.35) return null;
  return { id: `${input.projectId}:goal_dropoff:${input.goalId}`, projectId: input.projectId, kind: "goal_dropoff", title: `Revise o caminho de “${input.goalName}”`, explanation: "Poucas sessões desta meta chegaram a uma ação. Revise clareza, quantidade de etapas e destino antes de publicar qualquer alteração.", evidence: { totalSessions: input.totalSessions, goalSessions: input.goalSessions, actionSessions: input.actionSessions, actionRate: Math.round(rate * 1000) / 10 }, status: "open", createdAt: new Date().toISOString() };
}
