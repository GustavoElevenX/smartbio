import { describe, expect, it } from "vitest";
import { conversionGoalsSchema } from "@/features/conversion-goals/schema";
import { backfillConversionGoals } from "@/features/conversion-goals/utils";
import { casaDeSucos } from "@/data/demo-projects";
describe("conversion goals", () => {
  it("validates one primary goal and unique order", () => expect(conversionGoalsSchema.safeParse(casaDeSucos.conversionGoals).success).toBe(true));
  it("backfills a stable goal from a legacy project", () => { const goals = backfillConversionGoals({ ...casaDeSucos, conversionGoals: undefined }); expect(goals.length).toBeGreaterThan(0); expect(goals[0].isPrimary).toBe(true); expect(casaDeSucos.steps.some((step) => step.id === goals[0].targetStepId)).toBe(true); });
});
