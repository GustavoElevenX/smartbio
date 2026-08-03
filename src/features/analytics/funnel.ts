import type { AnalyticsEvent } from "@/types";

export function calculateFunnel(events: AnalyticsEvent[]) {
  const countSessions = (name: AnalyticsEvent["eventName"]) => new Set(events.filter((event) => event.eventName === name).map((event) => event.sessionId)).size;
  const steps = [
    { key: "views", label: "Visualizações", value: countSessions("page_view") },
    { key: "intent", label: "Intenção selecionada", value: countSessions("option_clicked") },
    { key: "qualification", label: "Qualificação iniciada", value: countSessions("form_started") },
    { key: "recommendation", label: "Recomendação visualizada", value: countSessions("recommendation_viewed") },
    { key: "cta", label: "CTA clicado", value: new Set(events.filter((event) => ["cta_clicked", "whatsapp_clicked", "external_link_clicked"].includes(event.eventName)).map((event) => event.sessionId)).size },
    { key: "lead", label: "Lead capturado", value: countSessions("form_submitted") },
  ];
  return steps.map((step, index) => ({ ...step, rate: index === 0 ? 100 : Math.round(step.value / Math.max(1, steps[0].value) * 100), dropOff: index === 0 ? 0 : Math.max(0, steps[index - 1].value - step.value) }));
}
