import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getTrialDaysRemaining, SOBE_PRO, SOBE_TRIAL } from "@/lib/sobe-pro";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608180042_sobe_pro_launch.sql"), "utf8");
const trialService = readFileSync(resolve(process.cwd(), "src/server/entitlements/trial-service.ts"), "utf8");
const publicRepository = readFileSync(resolve(process.cwd(), "src/server/repositories/public-project-repository.ts"), "utf8");

describe("SOBE commercial model", () => {
  it("keeps one canonical public offer", () => {
    expect(SOBE_PRO.formattedPrice).toBe("R$ 69,90");
    expect(SOBE_PRO.publicLimits).toEqual({ businesses: 1, publishedPages: 5, teamMembers: 3, aiActionsPerMonth: 50 });
    expect(SOBE_TRIAL.limits.aiActionsTotal).toBe(10);
    expect(migration).toContain("update public.plan_catalog set is_active=false,is_public=false where plan_key in ('free','business')");
  });

  it("starts the trial only after the first structure and expires public access", () => {
    expect(trialService).toContain("trial_started_after_first_structure");
    expect(trialService).toContain("endsAt.setUTCDate(endsAt.getUTCDate() + SOBE_TRIAL.days)");
    expect(publicRepository).toContain("isWorkspacePublicAccessActive");
  });

  it("reports calendar days remaining without negative values", () => {
    expect(getTrialDaysRemaining("2026-08-20T12:00:00.000Z", new Date("2026-08-18T12:00:00.000Z"))).toBe(2);
    expect(getTrialDaysRemaining("2026-08-17T12:00:00.000Z", new Date("2026-08-18T12:00:00.000Z"))).toBe(0);
  });
});
