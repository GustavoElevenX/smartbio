import { describe, expect, it } from "vitest";
import { hasEnoughEvidence } from "@/features/optimization/evidence";
import { goalDropoffRule } from "@/features/optimization/rules";
describe("optimization thresholds", () => {
  it("requires 30 business sessions and 15 goal sessions", () => { expect(hasEnoughEvidence(29, 20)).toBe(false); expect(hasEnoughEvidence(30, 14)).toBe(false); expect(hasEnoughEvidence(30, 15)).toBe(true); });
  it("never suggests without enough evidence", () => expect(goalDropoffRule({ projectId: "p", goalId: "g", goalName: "Comprar", totalSessions: 29, goalSessions: 20, actionSessions: 1 })).toBeNull());
});
