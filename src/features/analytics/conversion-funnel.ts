import type { AnalyticsEvent, CommercialOpportunity } from "@/types";

export interface ConversionFunnelStage { key: "attention" | "intention" | "action" | "opportunity" | "conversion"; label: string; sessions: number; rateFromAttention: number; rateFromPrevious: number; }
const actionEvents: AnalyticsEvent["eventName"][] = ["form_submitted", "quote_submitted", "booking_submitted", "order_submitted", "reservation_submitted", "route_resolved", "whatsapp_clicked", "external_link_clicked", "payment_started"];
const sessionSet = (events: AnalyticsEvent[], names: AnalyticsEvent["eventName"][]) => new Set(events.filter((event) => names.includes(event.eventName)).map((event) => event.sessionId));

export function buildConversionFunnel(events: AnalyticsEvent[], opportunities: CommercialOpportunity[] = []): ConversionFunnelStage[] {
  const attention = sessionSet(events, ["page_view", "presence_page_viewed", "session_started"]);
  const intention = sessionSet(events, ["presence_cta_clicked", "presence_conversion_started", "conversion_goal_selected", "conversion_goal_resolved"]);
  const action = sessionSet(events, actionEvents);
  const opportunity = new Set([...opportunities.map((item) => item.sessionId).filter(Boolean), ...sessionSet(events, ["opportunity_created"])]);
  const conversion = new Set([...opportunities.filter((item) => item.status === "converted").map((item) => item.sessionId).filter(Boolean), ...sessionSet(events, ["conversion_confirmed"])]);
  const sets = [attention, intention, action, opportunity, conversion];
  const labels = ["Atenção", "Intenção", "Ação", "Oportunidade", "Conversão"] as const;
  const keys = ["attention", "intention", "action", "opportunity", "conversion"] as const;
  return sets.map((set, index) => ({ key: keys[index], label: labels[index], sessions: set.size,
    rateFromAttention: attention.size ? Math.round((set.size / attention.size) * 1000) / 10 : 0,
    rateFromPrevious: index === 0 ? 100 : sets[index - 1].size ? Math.round((set.size / sets[index - 1].size) * 1000) / 10 : 0 }));
}
