import { describe, expect, it } from "vitest";
import { buildConversionFunnel } from "@/features/analytics/conversion-funnel";
import { comparePeriods } from "@/features/analytics/period-comparison";
import { buildConversionAnalytics } from "@/server/analytics/conversion-analytics";
import type { AnalyticsEvent, CommercialOpportunity } from "@/types";
const event = (
  eventName: AnalyticsEvent["eventName"],
  sessionId: string,
): AnalyticsEvent => ({
  id: `${eventName}-${sessionId}`,
  projectId: "p",
  visitorId: sessionId,
  sessionId,
  eventName,
  createdAt: "2026-08-11T10:00:00.000Z",
});
describe("conversion analytics", () => {
  const events = [
    event("page_view", "s1"),
    event("conversion_goal_selected", "s1"),
    event("form_submitted", "s1"),
    event("opportunity_created", "s1"),
    event("conversion_confirmed", "s1"),
    event("page_view", "s2"),
  ];
  it("uses commercial opportunities as the authority for opportunity and conversion", () => {
    const opportunity = {
      id: "o1",
      workspaceId: "w",
      projectId: "p",
      sessionId: "s1",
      sourceType: "lead" as const,
      sourceId: "l1",
      status: "converted" as const,
      title: "Lead",
      currency: "BRL",
      metadata: {},
      createdAt: "2026-08-11T10:00:00.000Z",
      updatedAt: "2026-08-11T10:00:00.000Z",
    } satisfies CommercialOpportunity;
    expect(
      buildConversionFunnel(events, [opportunity]).map((stage) => stage.sessions),
    ).toEqual([2, 1, 1, 1, 1]);
  });
  it("ignores commercial events when there is no authoritative opportunity", () =>
    expect(
      buildConversionFunnel(events).map((stage) => stage.sessions),
    ).toEqual([2, 1, 1, 0, 0]));
  it("classifies Presence CTA as action, not intention", () => {
    const signals = [
      event("presence_page_viewed", "s1"),
      event("presence_cta_clicked", "s1"),
      event("presence_conversion_started", "s1"),
    ];
    expect(
      buildConversionFunnel(signals).map((stage) => stage.sessions),
    ).toEqual([1, 0, 1, 0, 0]);
  });
  it("does not invent a comparison when previous period is empty", () =>
    expect(comparePeriods(10, 0)).toMatchObject({
      changePercent: null,
      label: "Sem comparação ainda",
    }));
  it("counts only manually converted opportunity value", () => {
    const base = {
      id: "o",
      workspaceId: "w",
      projectId: "p",
      sourceType: "lead" as const,
      sourceId: "l",
      title: "Lead",
      currency: "BRL",
      metadata: {},
      createdAt: "2026-08-11T10:00:00.000Z",
      updatedAt: "2026-08-11T10:00:00.000Z",
    };
    const opportunities = [
      { ...base, status: "new" as const, estimatedValue: 9000 },
      {
        ...base,
        id: "o2",
        sourceId: "l2",
        status: "converted" as const,
        confirmedValue: 700,
      },
    ] satisfies CommercialOpportunity[];
    expect(
      buildConversionAnalytics({ events: [], opportunities }).confirmedValue,
    ).toBe(700);
  });
});
