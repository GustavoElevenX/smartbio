import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { activationUnderstandingSchema, aiSetupQuestionSchema, aiBusinessAnalysisResultSchema, brandAIResultSchema, commercialArchitectureSchema, extractedBusinessSourceSchema } from "@/features/ai-setup/ai-setup.schema";
import { aiSiteStructureSchema } from "@/features/site-composer/site-composer.schema";
import { aiDiscoveryPlanDraftSchema } from "@/features/qualification/discovery-plan";
import { documentOutputInstruction, documentOutputSchema, parseDocumentOutput } from "@/server/ai/document-output";
import { aiJourneyDraftSchema } from "@/features/composition/composition.schema";
import { aiPresenceDraftSchema } from "@/features/presence/ai-presence.schema";
import { aiActivationDraftSchema } from "@/features/activations/ai-activation.schema";

describe("OpenAI Structured Outputs schemas", () => {
  it.each([aiJourneyDraftSchema, aiPresenceDraftSchema, aiActivationDraftSchema])("transporta documentos extensíveis e mantém a validação antes de aplicar", (schema: z.ZodType) => {
    expect(() => zodTextFormat(documentOutputSchema, "editor_document")).not.toThrow();
    expect(documentOutputInstruction(schema)).toContain("CONTRATO_JSON");
    expect(() => parseDocumentOutput(schema, { documentJson: "{}" })).toThrow();
    expect(() => parseDocumentOutput(schema, { documentJson: "inválido" })).toThrow();
  });
  it("serializa as perguntas de confirmação", () => { expect(() => zodTextFormat(aiSetupQuestionSchema, "setup_question")).not.toThrow(); });
  it("serializa a análise de negócio sem perder campos opcionais", () => {
    expect(() => zodTextFormat(aiBusinessAnalysisResultSchema, "business_analysis")).not.toThrow();
  });
  it("serializa perfis e perguntas de descoberta com campos opcionais nulos", () => {
    expect(() => zodTextFormat(aiDiscoveryPlanDraftSchema, "discovery_plan_draft")).not.toThrow();
  });
  it("serializa a composição do site sem objetos de conteúdo abertos", () => {
    expect(() => zodTextFormat(aiSiteStructureSchema, "site_structure")).not.toThrow();
  });
  it("keeps source extraction fields required or nullable", () => {
    expect(() => zodTextFormat(extractedBusinessSourceSchema, "extracted_source")).not.toThrow();
  });

  it("keeps brand analysis compatible with strict output", () => {
    expect(() => zodTextFormat(brandAIResultSchema, "brand_analysis")).not.toThrow();
  });

  it("mantém ActivationUnderstanding compatível com Structured Outputs", () => {
    expect(() => zodTextFormat(activationUnderstandingSchema, "activation_understanding")).not.toThrow();
  });

  it("mantém CommercialArchitecture compatível com Structured Outputs", () => {
    expect(() => zodTextFormat(commercialArchitectureSchema, "commercial_architecture")).not.toThrow();
  });
});
