import { describe, expect, it } from "vitest";
import { createPresencePage } from "@/features/presence/presence-page-service";
import { inspectPageQuality } from "@/features/site-composer/site-quality";

describe("site quality assistant", () => {
  it("detects an empty FAQ and a hero without a usable CTA", () => {
    const page = createPresencePage(crypto.randomUUID(), "Início", "home");
    page.defaultConversionGoalId = undefined;
    page.sections.push({ id: crypto.randomUUID(), pageId: page.id, key: "faq", type: "faq", title: "Dúvidas", content: { items: [] }, style: {}, settings: {}, order: 2, isActive: true });
    const codes = inspectPageQuality(page).map((warning) => warning.code);
    expect(codes).toContain("hero_missing_cta");
    expect(codes).toContain("empty_faq");
  });
});
