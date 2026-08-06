import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { aiJourneyDraftSchema } from "@/features/composition/composition.schema";
import {
  brandAIResultSchema,
  businessAnalysisResultSchema,
  copyGenerationResultSchema,
  extractedBusinessSourceSchema,
  setupQuestionSchema,
} from "@/features/ai-setup/ai-setup.schema";
import { readServerEnv } from "@/lib/env/server";
import { AIConfigurationError, normalizeAIError } from "@/server/ai/ai-errors";
import type {
  BrandAIInput,
  BusinessAnalysisInput,
  CopyGenerationInput,
  JourneyAIInput,
  MissingQuestionInput,
  SmartBioAIProvider,
  SourceExtractionInput,
  StructuredAIRequest,
} from "@/server/ai/ai-provider";
import { recordAIUsage } from "@/server/ai/ai-usage";
import { brandAnalysisPrompt } from "@/server/ai/prompts/brand-analysis";
import { businessAnalysisPrompt } from "@/server/ai/prompts/business-analysis";
import { copyGenerationPrompt } from "@/server/ai/prompts/copy-generation";
import { journeyCompositionPrompt } from "@/server/ai/prompts/journey-composition";
import { missingQuestionsPrompt } from "@/server/ai/prompts/missing-questions";
import { sourceExtractionPrompt } from "@/server/ai/prompts/source-extraction";

const questionListSchema = z.object({ questions: z.array(setupQuestionSchema).max(5) });

export class OpenAISmartBioProvider implements SmartBioAIProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly visionModel: string;
  private readonly maxOutputTokens: number;
  private readonly promptVersion: string;

  constructor() {
    const env = readServerEnv();
    if (!env.OPENAI_API_KEY) throw new AIConfigurationError();
    this.model = env.OPENAI_MODEL || "gpt-5.6";
    this.timeoutMs = env.AI_REQUEST_TIMEOUT_MS;
    this.maxRetries = env.AI_MAX_RETRIES;
    this.visionModel = env.OPENAI_VISION_MODEL || this.model;
    this.maxOutputTokens = env.OPENAI_MAX_OUTPUT_TOKENS;
    this.promptVersion = env.AI_PROMPT_VERSION;
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: this.timeoutMs, maxRetries: 0 });
  }

  private async structured<T>({ operation, schemaName, schema, systemPrompt, payload, context, model, userContent }: StructuredAIRequest<T>): Promise<T> {
    const startedAt = Date.now();
    const selectedModel = model || this.model;
    await recordAIUsage({ ...context, operation, provider: "openai", model: selectedModel, promptVersion: this.promptVersion, status: "started", inputSummary: { payloadBytes: JSON.stringify(payload).length } });
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.responses.parse({
          model: selectedModel,
          max_output_tokens: this.maxOutputTokens,
          reasoning: { effort: "low" },
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent || `DADOS_DELIMITADOS_INICIO\n${JSON.stringify(payload)}\nDADOS_DELIMITADOS_FIM` },
          ],
          text: { format: zodTextFormat(schema, schemaName) },
        });
        if (!response.output_parsed) throw new Error("O provider não retornou uma saída estruturada.");
        const parsed = schema.parse(response.output_parsed);
        await recordAIUsage({
          ...context,
          operation,
          provider: "openai",
          model: selectedModel,
          promptVersion: this.promptVersion,
          status: "completed",
          durationMs: Date.now() - startedAt,
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          outputSummary: operation === "journey_composition" && parsed && typeof parsed === "object" ? { outputBytes: JSON.stringify(parsed).length, suggestedCapabilities: (parsed as { suggestedCapabilities?: Array<{ key: string }> }).suggestedCapabilities?.map((item) => item.key) || [], appliedCandidates: (parsed as { suggestedCapabilities?: Array<{ key: string; enabled: boolean }> }).suggestedCapabilities?.filter((item) => item.enabled).map((item) => item.key) || [], proposedConfigSections: Object.keys((parsed as { commercialConfigPatch?: Record<string, unknown> }).commercialConfigPatch || {}), requirementsCreated: (parsed as { requirements?: unknown[] }).requirements?.length || 0 } : { outputBytes: JSON.stringify(parsed).length },
        });
        return parsed;
      } catch (error) {
        const normalized = normalizeAIError(error);
        lastError = normalized;
        if (!normalized.retryable || attempt === this.maxRetries) break;
      }
    }
    const normalized = normalizeAIError(lastError);
    await recordAIUsage({ ...context, operation, provider: "openai", model: selectedModel, promptVersion: this.promptVersion, status: "failed", durationMs: Date.now() - startedAt, errorCode: normalized.code });
    throw normalized;
  }

  analyzeBusiness(input: BusinessAnalysisInput) {
    return this.structured({ operation: "business_analysis", schemaName: "business_analysis", schema: businessAnalysisResultSchema, systemPrompt: businessAnalysisPrompt, payload: { business: input.input, sources: input.sources || [] }, context: input });
  }

  async generateMissingQuestions(input: MissingQuestionInput) {
    const result = await this.structured({ operation: "missing_questions", schemaName: "missing_questions", schema: questionListSchema, systemPrompt: missingQuestionsPrompt, payload: { profile: input.profile, requirements: input.requirements || [], answers: input.answers }, context: input });
    return result.questions;
  }

  composeJourney(input: JourneyAIInput) {
    return this.structured({ operation: "journey_composition", schemaName: "journey_draft", schema: aiJourneyDraftSchema, systemPrompt: journeyCompositionPrompt, payload: input, context: input });
  }

  generateCopy(input: CopyGenerationInput) {
    return this.structured({ operation: "copy_generation", schemaName: "copy_suggestions", schema: copyGenerationResultSchema, systemPrompt: copyGenerationPrompt, payload: input, context: input });
  }

  extractSource(input: SourceExtractionInput) {
    const instruction = { type: "input_text" as const, text: `DADOS_DELIMITADOS_INICIO\n${JSON.stringify({ sourceId: input.sourceId, sourceType: input.sourceType, name: input.name, content: input.content })}\nDADOS_DELIMITADOS_FIM` };
    const visual = input.fileData && input.mimeType?.startsWith("image/") ? { type: "input_image" as const, image_url: `data:${input.mimeType};base64,${input.fileData}`, detail: "high" as const } : undefined;
    return this.structured({ operation: "source_extraction", schemaName: "extracted_source", schema: extractedBusinessSourceSchema, systemPrompt: sourceExtractionPrompt, payload: input, userContent: visual ? [instruction, visual] : [instruction], context: input, model: visual ? this.visionModel : undefined });
  }

  analyzeBrand(input: BrandAIInput) {
    return this.structured({ operation: "brand_analysis", schemaName: "brand_analysis", schema: brandAIResultSchema, systemPrompt: brandAnalysisPrompt, payload: input, context: input });
  }
}
