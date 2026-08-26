import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import { activationUnderstandingSchema, brandAIResultSchema, extractedBusinessSourceSchema } from "@/features/ai-setup/ai-setup.schema";

describe("OpenAI Structured Outputs schemas", () => {
  it("keeps source extraction fields required or nullable", () => {
    expect(() => zodTextFormat(extractedBusinessSourceSchema, "extracted_source")).not.toThrow();
  });

  it("keeps brand analysis compatible with strict output", () => {
    expect(() => zodTextFormat(brandAIResultSchema, "brand_analysis")).not.toThrow();
  });

  it("mantém ActivationUnderstanding compatível com Structured Outputs", () => {
    expect(() => zodTextFormat(activationUnderstandingSchema, "activation_understanding")).not.toThrow();
  });
});
