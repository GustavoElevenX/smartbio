import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateObservationalChange } from "@/features/optimization/evaluation";
import { entryUnderperformanceRules, journeyFrictionRules, presenceRules } from "@/features/optimization/rules";
import { resolveNextBestAction } from "@/features/dashboard/next-best-action";
import { applyEntryChannelPreset } from "@/features/entry-points/presets";
import { buildTrialValueSummary } from "@/features/billing/trial-value-summary";
import { feedbackSchema } from "@/app/api/billing/cancel/route";
import type { AnalyticsEvent, EntryPoint } from "@/types";

const event = (sessionId: string, eventName: AnalyticsEvent["eventName"], patch: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({ id: `${sessionId}:${eventName}:${Math.random()}`, projectId: "p", visitorId: sessionId, sessionId, eventName, createdAt: "2026-08-01T00:00:00.000Z", ...patch });
const entry = (id: string): EntryPoint => ({ id, projectId: "p", key: id, name: id, channel: "bio", conversionGoalId: "g", isActive: true });

describe("Conversion Intelligence v1", () => {
  it("classifies observational deltas without causal claims", () => {
    expect(evaluateObservationalChange({ sessions: 20, opportunities: 1, conversions: 0, confirmedValue: 0, rate: 0.1 }, { sessions: 40, opportunities: 8, conversions: 2, confirmedValue: 200, rate: 0.2 }).result).toBe("insufficient");
    expect(evaluateObservationalChange({ sessions: 40, opportunities: 4, conversions: 1, confirmedValue: 100, rate: 0.1 }, { sessions: 40, opportunities: 8, conversions: 2, confirmedValue: 200, rate: 0.2 })).toMatchObject({ result: "positive", method: "observational_before_after_v1", absoluteDelta: 0.1 });
  });

  it("compares only entries with meaningful volume", () => {
    const events: AnalyticsEvent[] = [];
    for (let index = 0; index < 30; index++) {
      events.push(event(`a-${index}`, "page_view", { entryPointId: "a" }), event(`b-${index}`, "page_view", { entryPointId: "b" }));
      if (index < 3) events.push(event(`a-${index}`, "form_submitted", { entryPointId: "a" }));
      if (index < 15) events.push(event(`b-${index}`, "form_submitted", { entryPointId: "b" }));
    }
    expect(entryUnderperformanceRules({ projectId: "p", entries: [entry("a"), entry("b")], events })).toHaveLength(1);
  });

  it("detects journey and presence friction only above thresholds", () => {
    const events: AnalyticsEvent[] = [];
    for (let index = 0; index < 30; index++) {
      events.push(event(`s-${index}`, "step_viewed", { stepId: "step" }), event(`s-${index}`, "presence_page_viewed", { presencePageId: "page" }));
      if (index < 3) events.push(event(`s-${index}`, "option_clicked", { stepId: "step" }));
    }
    expect(journeyFrictionRules({ projectId: "p", events })).toHaveLength(1);
    expect(presenceRules({ projectId: "p", events }).map((item) => item.kind)).toEqual(expect.arrayContaining(["presence_cta", "presence_structure"]));
  });

  it("resolves a deterministic next action", () => {
    expect(resolveNextBestAction({ hasProjects: true, published: true, sessions: 20, intentions: 0, actions: 0, opportunities: 0, conversions: 0 }).key).toBe("clarify");
    expect(resolveNextBestAction({ hasProjects: true, published: true, sessions: 20, intentions: 5, actions: 3, opportunities: 2, conversions: 0 }).key).toBe("confirm");
  });

  it("applies channel defaults without inventing campaign", () => {
    const result = applyEntryChannelPreset({ ...entry("e"), utmCampaign: "lancamento" }, "instagram_reel");
    expect(result).toMatchObject({ utmSource: "instagram", utmMedium: "organic_social", utmCampaign: "lancamento" });
  });

  it("freezes version server-side and keeps learning metadata free of lead PII", () => {
    const route = readFileSync("src/app/api/events/route.ts", "utf8");
    const migration = readFileSync("supabase/migrations/202608240046_conversion_intelligence.sql", "utf8");
    expect(route).toContain('select("published_version_id,status")');
    expect(route).not.toContain("data.projectVersionId");
    expect(migration).toMatch(/visitor_sessions[\s\S]*project_version_id/i);
    expect(migration).toMatch(/optimization_experiments[\s\S]*enable row level security/i);
  });

  it("summarizes only confirmed trial value", () => {
    expect(buildTrialValueSummary({ periodDays: 7, sessions: 12, opportunities: [{ status: "open", confirmed_value: 900 }, { status: "converted", confirmed_value: 150 }] })).toEqual({ periodDays: 7, sessions: 12, opportunities: 2, conversions: 1, confirmedValue: 150 });
  });

  it("validates optional cancellation feedback", () => {
    expect(feedbackSchema.parse({ reason: "no_result", comment: "Ainda sem retorno." })).toMatchObject({ reason: "no_result" });
    expect(() => feedbackSchema.parse({ reason: "invented" })).toThrow();
    expect(() => feedbackSchema.parse({ comment: "x".repeat(1001) })).toThrow();
  });

  it("keeps lifecycle milestones idempotent", () => {
    const source = readFileSync("src/server/platform-acquisition/platform-acquisition.ts", "utf8");
    expect(source).toContain('{ onConflict: "idempotency_key", ignoreDuplicates: true }');
  });
});
