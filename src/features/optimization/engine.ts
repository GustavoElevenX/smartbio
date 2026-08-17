import type { AnalyticsEvent, ConversionGoal, OptimizationSuggestion } from "@/types";
import { goalDropoffRule } from "./rules";
export function buildOptimizationSuggestions(projectId: string, goals: ConversionGoal[], events: AnalyticsEvent[], publishedAt = events[0]?.createdAt): OptimizationSuggestion[] {
  const totalSessions = new Set(events.map((event) => event.sessionId)).size;
  const periodStart = events[0]?.createdAt || new Date().toISOString();
  const periodEnd = events.at(-1)?.createdAt || periodStart;
  if (!publishedAt) return [];
  return goals.map((goal) => { const goalEvents = events.filter((event) => event.conversionGoalId === goal.id); const goalSessions = new Set(goalEvents.map((event) => event.sessionId)).size; const actionSessions = new Set(goalEvents.filter((event) => ["form_submitted","quote_submitted","booking_submitted","order_submitted","reservation_submitted","route_resolved"].includes(event.eventName)).map((event) => event.sessionId)).size; return goalDropoffRule({ projectId, goalId: goal.id, goalName: goal.name, publishedAt, periodStart, periodEnd, totalSessions, goalSessions, actionSessions }); }).filter((item): item is OptimizationSuggestion => Boolean(item));
}
