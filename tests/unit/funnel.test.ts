import { describe, expect, it } from "vitest";
import { calculateFunnel } from "@/features/analytics/funnel";
import type { AnalyticsEvent } from "@/types";

const event = (sessionId: string, eventName: AnalyticsEvent["eventName"]): AnalyticsEvent => ({ id: `${sessionId}-${eventName}`, projectId: "project", visitorId: sessionId, sessionId, eventName, createdAt: new Date().toISOString() });

describe("funil", () => {
  it("deduplica por sessão e calcula abandono", () => { const result = calculateFunnel([event("a", "page_view"), event("a", "page_view"), event("b", "page_view"), event("a", "option_clicked"), event("a", "form_started")]); expect(result[0].value).toBe(2); expect(result[1].value).toBe(1); expect(result[1].rate).toBe(50); expect(result[1].dropOff).toBe(1); });
});
