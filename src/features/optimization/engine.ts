import type { AnalyticsEvent, ConversionGoal, OptimizationSuggestion } from "@/types";
import type { EntryPoint } from "@/types";
import { entryUnderperformanceRules, goalDropoffRule, journeyFrictionRules, presenceRules } from "./rules";
export function buildOptimizationSuggestions(projectId: string, goals: ConversionGoal[], events: AnalyticsEvent[], publishedAt?: string, entries: EntryPoint[] = []): OptimizationSuggestion[] {
  const totalSessions = new Set(events.map((event) => event.sessionId)).size;
  const periodStart = events[0]?.createdAt || new Date().toISOString();
  const periodEnd = events.at(-1)?.createdAt || periodStart;
  if (!publishedAt) return [];
  const goalSuggestions = goals.map((goal) => { const goalEvents = events.filter((event) => event.conversionGoalId === goal.id); const goalSessions = new Set(goalEvents.map((event) => event.sessionId)).size; const actionSessions = new Set(goalEvents.filter((event) => ["form_submitted","quote_submitted","booking_submitted","order_submitted","reservation_submitted","route_resolved","whatsapp_clicked","external_link_clicked"].includes(event.eventName)).map((event) => event.sessionId)).size; return goalDropoffRule({ projectId, goalId: goal.id, goalName: goal.name, publishedAt, periodStart, periodEnd, totalSessions, goalSessions, actionSessions }); }).filter((item): item is OptimizationSuggestion => Boolean(item));
  return [...goalSuggestions, ...entryUnderperformanceRules({ projectId, entries, events }), ...journeyFrictionRules({ projectId, events }), ...presenceRules({ projectId, events })];
}
