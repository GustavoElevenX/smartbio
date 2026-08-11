import { describe, expect, it } from "vitest";
import { resolveEntryPoint } from "@/features/entry-points/resolve";
import { entryPointUrl } from "@/features/entry-points/url";
import { resolveAttribution } from "@/features/attribution/attribution";
import { casaDeSucos } from "@/data/demo-projects";
describe("entry points and attribution", () => {
  const entry = casaDeSucos.entryPoints![1]; const goal = casaDeSucos.conversionGoals!.find((item) => item.id === entry.conversionGoalId)!;
  it("resolves entry, goal and target step", () => expect(resolveEntryPoint(casaDeSucos.entryPoints!, casaDeSucos.conversionGoals!, casaDeSucos.steps, entry.key)).toMatchObject({ entry: { id: entry.id }, goal: { id: goal.id }, step: { id: goal.targetStepId } }));
  it("builds a public entry URL", () => expect(entryPointUrl("minha-bio", entry, "https://virou.test")).toBe(`https://virou.test/minha-bio?entry=${entry.key}`));
  it("gives explicit UTM precedence over entry defaults", () => expect(resolveAttribution({ explicit: { source: "newsletter", campaign: "explicit" }, entry, referrer: "https://instagram.com" })).toMatchObject({ source: "newsletter", campaign: "explicit", medium: entry.utmMedium, entryPointId: entry.id }));
  it("falls back to referrer and direct", () => { expect(resolveAttribution({ explicit: {}, referrer: "https://linkedin.com/post" }).source).toBe("linkedin.com"); expect(resolveAttribution({ explicit: {} }).source).toBe("direct"); });
});
