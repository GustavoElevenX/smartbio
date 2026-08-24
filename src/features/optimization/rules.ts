import type { AnalyticsEvent, EntryPoint, OptimizationSuggestion } from "@/types";
import { hasEnoughEvidence } from "./evidence";
import { ACTION_EVENT_NAMES, OPTIMIZATION_THRESHOLDS } from "./config";
export function goalDropoffRule(input: { projectId: string; goalId: string; goalName: string; publishedAt?: string; periodStart?: string; periodEnd?: string; totalSessions: number; goalSessions: number; actionSessions: number }): OptimizationSuggestion | null {
  if (input.publishedAt && input.periodStart && input.periodEnd ? !hasEnoughEvidence({ ...input, publishedAt: input.publishedAt, periodStart: input.periodStart, periodEnd: input.periodEnd }) : !hasEnoughEvidence(input.totalSessions, input.goalSessions)) return null;
  const rate = input.goalSessions ? input.actionSessions / input.goalSessions : 0; if (rate >= 0.35) return null;
  return { id: `${input.projectId}:goal_dropoff:${input.goalId}`, projectId: input.projectId, kind: "goal_dropoff", title: `Revise o caminho de “${input.goalName}”`, explanation: "Poucas sessões desta meta chegaram a uma ação. Revise clareza e quantidade de etapas antes de publicar qualquer alteração.", evidence: { totalSessions: input.totalSessions, goalSessions: input.goalSessions, actionSessions: input.actionSessions, actionRate: Math.round(rate * 1000) / 10 }, targetMetric: "action_rate", proposedChange: { changeType: "shorten_journey", before: { goalId: input.goalId }, after: { goalId: input.goalId, intent: "reduce_optional_friction" }, riskLevel: "medium" }, status: "open", createdAt: new Date().toISOString() };
}

const uniqueSessions = (events: AnalyticsEvent[]) => new Set(events.map((event) => event.sessionId)).size;
const actionSessions = (events: AnalyticsEvent[]) => uniqueSessions(events.filter((event) => (ACTION_EVENT_NAMES as readonly string[]).includes(event.eventName)));

export function entryUnderperformanceRules(input: {
  projectId: string;
  entries: EntryPoint[];
  events: AnalyticsEvent[];
}): OptimizationSuggestion[] {
  const eligible = input.entries.map((entry) => {
    const events = input.events.filter((event) => event.entryPointId === entry.id);
    const sessions = uniqueSessions(events);
    const actions = actionSessions(events);
    return { entry, sessions, actions, rate: sessions ? actions / sessions : 0 };
  }).filter((item) => item.sessions >= OPTIMIZATION_THRESHOLDS.comparisonEntrySessions);
  if (eligible.length < 2) return [];
  const best = Math.max(...eligible.map((item) => item.rate));
  return eligible.filter((item) => best - item.rate >= OPTIMIZATION_THRESHOLDS.minimumMeaningfulAbsoluteDelta).map((item) => ({
    id: `${input.projectId}:entry_underperformance:${item.entry.id}`,
    projectId: input.projectId,
    kind: "entry_underperformance" as const,
    title: `Revise a entrada “${item.entry.name}”`,
    explanation: "Esta entrada teve action rate observado menor que outra entrada com volume comparável. Outros fatores também podem ter influenciado.",
    evidence: { sessions: item.sessions, actionSessions: item.actions, actionRate: Math.round(item.rate * 1000) / 10, bestComparableRate: Math.round(best * 1000) / 10 },
    targetMetric: "action_rate" as const,
    proposedChange: { changeType: "change_entry_surface" as const, before: { entryId: item.entry.id, surfaceMode: item.entry.surfaceMode || "conversion_direct" }, after: { entryId: item.entry.id, intent: "review_surface_for_channel" }, riskLevel: "medium" as const },
    status: "open" as const,
    createdAt: new Date().toISOString(),
  }));
}

export function journeyFrictionRules(input: { projectId: string; events: AnalyticsEvent[] }): OptimizationSuggestion[] {
  const stepIds = [...new Set(input.events.map((event) => event.stepId).filter((id): id is string => Boolean(id)))];
  return stepIds.flatMap((stepId) => {
    const stepEvents = input.events.filter((event) => event.stepId === stepId);
    const views = uniqueSessions(stepEvents.filter((event) => event.eventName === "step_viewed"));
    const advances = uniqueSessions(stepEvents.filter((event) => ["option_clicked", ...ACTION_EVENT_NAMES].includes(event.eventName as never)));
    const rate = views ? advances / views : 0;
    if (views < OPTIMIZATION_THRESHOLDS.journeyStepViews || rate >= 0.35) return [];
    return [{ id: `${input.projectId}:journey_friction:${stepId}`, projectId: input.projectId, kind: "journey_friction" as const, title: "Revise uma etapa com abandono recorrente", explanation: "Muitas sessões visualizaram esta etapa e poucas avançaram. Verifique escolhas, campos opcionais e clareza do próximo passo.", evidence: { stepId, views, advances, advanceRate: Math.round(rate * 1000) / 10 }, targetMetric: "action_rate" as const, proposedChange: { changeType: "simplify_choice_set" as const, before: { stepId }, after: { stepId, intent: "reduce_choice_friction" }, riskLevel: "medium" as const }, status: "open" as const, createdAt: new Date().toISOString() }];
  });
}

export function presenceRules(input: { projectId: string; events: AnalyticsEvent[] }): OptimizationSuggestion[] {
  const pageIds = [...new Set(input.events.map((event) => event.presencePageId).filter((id): id is string => Boolean(id)))];
  return pageIds.flatMap((pageId) => {
    const pageEvents = input.events.filter((event) => event.presencePageId === pageId);
    const views = uniqueSessions(pageEvents.filter((event) => event.eventName === "presence_page_viewed"));
    const intentions = uniqueSessions(pageEvents.filter((event) => ["conversion_goal_selected", "conversion_goal_resolved", "presence_conversion_started"].includes(event.eventName)));
    const cta = uniqueSessions(pageEvents.filter((event) => event.eventName === "presence_cta_clicked"));
    if (views < OPTIMIZATION_THRESHOLDS.presenceViews) return [];
    const suggestions: OptimizationSuggestion[] = [];
    if (intentions / views < 0.2) suggestions.push({ id: `${input.projectId}:presence_structure:${pageId}`, projectId: input.projectId, kind: "presence_structure", title: "Revise a passagem da página para a intenção", explanation: "A página recebeu volume suficiente, mas poucas sessões iniciaram uma intenção. Revise hierarquia e clareza do primeiro passo.", evidence: { pageId, views, intentions, intentionRate: Math.round((intentions / views) * 1000) / 10 }, targetMetric: "intention_rate", proposedChange: { changeType: "move_primary_cta", before: { pageId }, after: { pageId, intent: "increase_primary_action_visibility" }, riskLevel: "low" }, status: "open", createdAt: new Date().toISOString() });
    if (cta / views < 0.1) suggestions.push({ id: `${input.projectId}:presence_cta:${pageId}`, projectId: input.projectId, kind: "presence_cta", title: "Revise o CTA principal desta página", explanation: "O CTA primário teve poucos acionamentos em relação às sessões observadas.", evidence: { pageId, views, ctaSessions: cta, ctaRate: Math.round((cta / views) * 1000) / 10 }, targetMetric: "intention_rate", proposedChange: { changeType: "change_cta_copy", before: { pageId }, after: { pageId, intent: "clarify_next_action" }, riskLevel: "low" }, status: "open", createdAt: new Date().toISOString() });
    return suggestions;
  });
}
