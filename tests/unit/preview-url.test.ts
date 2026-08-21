import { describe, expect, it } from "vitest";
import { experiencePreviewUrl } from "@/features/preview/preview-url";

describe("experience preview URL", () => {
  it("opens the default bio preview", () => {
    expect(experiencePreviewUrl("casa-de-sucos-mix", "bio")).toBe(
      "/casa-de-sucos-mix/preview",
    );
  });

  it("preserves the selected entry point", () => {
    expect(experiencePreviewUrl("casa-de-sucos-mix", "entry:instagram bio")).toBe(
      "/casa-de-sucos-mix/preview?entry=instagram+bio",
    );
  });

  it("preserves the selected conversion goal", () => {
    expect(experiencePreviewUrl("casa-de-sucos-mix", "goal:goal-123")).toBe(
      "/casa-de-sucos-mix/preview?goal=goal-123",
    );
  });
});
