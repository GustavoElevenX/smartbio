import { describe, expect, it } from "vitest";
import { ENTITLEMENT_FEATURES } from "@/server/entitlements/entitlement-catalog";

describe("adaptive composer entitlements", () => {
  it.each(["presence_sections_per_page", "catalog_large", "ai_structure_suggestions", "ai_page_edits"] as const)("registers %s as a server entitlement", (feature) => {
    expect(ENTITLEMENT_FEATURES).toContain(feature);
  });
});
