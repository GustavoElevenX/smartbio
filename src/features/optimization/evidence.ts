export const OPTIMIZATION_MIN_SESSIONS = 30;
export const OPTIMIZATION_MIN_GOAL_SESSIONS = 15;
export function hasEnoughEvidence(totalSessions: number, goalSessions?: number) { return totalSessions >= OPTIMIZATION_MIN_SESSIONS && (goalSessions == null || goalSessions >= OPTIMIZATION_MIN_GOAL_SESSIONS); }
