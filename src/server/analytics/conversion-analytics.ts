import type { AnalyticsEvent, CommercialOpportunity, ConversionGoal, EntryPoint } from "@/types";
import { buildConversionFunnel } from "@/features/analytics/conversion-funnel";

export function buildConversionAnalytics(input: { events: AnalyticsEvent[]; opportunities: CommercialOpportunity[]; goals?: ConversionGoal[]; entries?: EntryPoint[] }) {
  const { events, opportunities } = input;
  const sessions = new Set(events.map((event) => event.sessionId));
  const confirmed = opportunities.filter((item) => item.status === "converted");
  const confirmedValue = confirmed.reduce((total, item) => total + (item.confirmedValue || 0), 0);
  const byGoal = (input.goals || []).map((goal) => ({ id: goal.id, name: goal.name, sessions: new Set(events.filter((event) => event.conversionGoalId === goal.id).map((event) => event.sessionId)).size, opportunities: opportunities.filter((item) => item.conversionGoalId === goal.id).length, conversions: confirmed.filter((item) => item.conversionGoalId === goal.id).length }));
  const byEntry = (input.entries || []).map((entry) => ({ id: entry.id, key: entry.key, name: entry.name, sessions: new Set(events.filter((event) => event.entryPointId === entry.id).map((event) => event.sessionId)).size, opportunities: opportunities.filter((item) => item.entryPointId === entry.id).length, conversions: confirmed.filter((item) => item.entryPointId === entry.id).length }));
  return { sessions: sessions.size, opportunities: opportunities.length, conversions: confirmed.length, confirmedValue, funnel: buildConversionFunnel(events, opportunities), byGoal, byEntry };
}
