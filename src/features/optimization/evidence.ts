export const OPTIMIZATION_MIN_DAYS = 30;
export const OPTIMIZATION_MIN_SESSIONS = 30;
export const OPTIMIZATION_MIN_GOAL_SESSIONS = 15;

export interface OptimizationEvidenceInput {
  publishedAt: string;
  periodStart: string;
  periodEnd: string;
  totalSessions: number;
  goalSessions?: number;
}

export interface OptimizationEvidenceState {
  eligible: boolean;
  completeDays: number;
  daysProgress: number;
  sessionsProgress: number;
  goalSessionsProgress?: number;
  message: string;
}

function completeDays(input: OptimizationEvidenceInput) {
  const start = Math.max(new Date(input.publishedAt).getTime(), new Date(input.periodStart).getTime());
  const end = new Date(input.periodEnd).getTime();
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function getOptimizationEvidenceState(input: OptimizationEvidenceInput): OptimizationEvidenceState {
  const days = completeDays(input);
  const eligible = days >= OPTIMIZATION_MIN_DAYS && input.totalSessions >= OPTIMIZATION_MIN_SESSIONS && (input.goalSessions == null || input.goalSessions >= OPTIMIZATION_MIN_GOAL_SESSIONS);
  return {
    eligible,
    completeDays: days,
    daysProgress: Math.min(1, days / OPTIMIZATION_MIN_DAYS),
    sessionsProgress: Math.min(1, input.totalSessions / OPTIMIZATION_MIN_SESSIONS),
    goalSessionsProgress: input.goalSessions == null ? undefined : Math.min(1, input.goalSessions / OPTIMIZATION_MIN_GOAL_SESSIONS),
    message: eligible
      ? "Há evidência suficiente para gerar sugestões de desempenho."
      : `A Sobe ainda está aprendendo com seus dados (${days}/30 dias, ${input.totalSessions}/30 sessões${input.goalSessions == null ? "" : `, ${input.goalSessions}/15 sessões da meta`}).`,
  };
}

export function hasEnoughEvidence(input: OptimizationEvidenceInput): boolean;
/** @deprecated Use o contrato com período e data de publicação. Mantido para compatibilidade interna. */
export function hasEnoughEvidence(totalSessions: number, goalSessions?: number): boolean;
export function hasEnoughEvidence(input: OptimizationEvidenceInput | number, goalSessions?: number) {
  if (typeof input === "number") return input >= OPTIMIZATION_MIN_SESSIONS && (goalSessions == null || goalSessions >= OPTIMIZATION_MIN_GOAL_SESSIONS);
  return getOptimizationEvidenceState(input).eligible;
}
