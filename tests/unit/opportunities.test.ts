import { describe, expect, it } from "vitest";
import { createOpportunity, opportunityIdempotencyKey } from "@/server/opportunities/factory";
import { canTransitionOpportunity, transitionOpportunity } from "@/server/opportunities/status";
const input = { workspaceId: "workspace", projectId: "project", sourceType: "quote" as const, sourceId: "quote-1", title: "Orçamento", visitorData: { name: "Ana", phone: "11999999999" }, now: "2026-08-11T10:00:00.000Z" };
describe("opportunities", () => {
  it("has a stable idempotency key", () => expect(opportunityIdempotencyKey(input)).toBe("project:quote:quote-1"));
  it("creates a safe unified opportunity", () => { const opportunity = createOpportunity(input); expect(opportunity).toMatchObject({ status: "new", contactName: "Ana", contactPhone: "11999999999" }); expect(opportunity.confirmedValue).toBeUndefined(); });
  it("allows conversion without inventing a confirmed value", () => { const opportunity = createOpportunity(input); expect(canTransitionOpportunity("new", "converted")).toBe(true); expect(transitionOpportunity(opportunity, "converted")).toMatchObject({ status: "converted", confirmedValue: undefined }); expect(transitionOpportunity(opportunity, "converted", { confirmedValue: 1200 })).toMatchObject({ status: "converted", confirmedValue: 1200 }); });
});
