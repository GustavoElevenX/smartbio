import type { z } from "zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { AttributionContext, BrandProfile, BusinessCapabilityProfile, ConversionGoal, ExperienceCompositionInput, MediaAsset, Project, ProjectCapability } from "@/types";
import type { AIPresenceDraft } from "@/features/presence/ai-presence.schema";
import type { AIJourneyDraftPayload } from "@/features/composition/composition.schema";
import type { BrandAIResult, BusinessAnalysisResult, CopyGenerationResult, ExtractedBusinessSource, SetupQuestion } from "@/features/ai-setup/ai-setup.schema";

export interface AIRequestContext {
  workspaceId: string;
  projectId?: string;
  setupSessionId?: string;
  userId?: string;
}

export interface BusinessAnalysisInput extends AIRequestContext {
  input: ExperienceCompositionInput;
  sources?: ExtractedBusinessSource[];
}

export interface MissingQuestionInput extends AIRequestContext {
  profile: BusinessCapabilityProfile;
  requirements: Project["dataRequirements"];
  answers: Record<string, unknown>;
}

export interface JourneyAIInput extends AIRequestContext {
  input: ExperienceCompositionInput;
  profile: BusinessCapabilityProfile;
  capabilities: ProjectCapability[];
  answers: Record<string, unknown>;
  confirmedCommercialData?: Project["commercialConfig"];
}

export interface CopyGenerationInput extends AIRequestContext {
  field: "title" | "text" | "cta";
  value: string;
  action: "improve" | "shorten" | "direct" | "premium" | "variations" | "adapt_tone" | "correct" | "explain_benefit" | "generate_cta";
  tone?: string;
  businessContext: string;
}

export interface SourceExtractionInput extends AIRequestContext {
  sourceId: string;
  sourceType: "website" | "text" | "pdf" | "image" | "csv" | "document";
  name: string;
  content?: string;
  fileData?: string;
  mimeType?: string;
}

export interface BrandAIInput extends AIRequestContext {
  businessName: string;
  businessDescription: string;
  extractedColors: string[];
  logoDescription?: string;
}

export interface PresenceCompositionInput extends AIRequestContext {
  businessProfile: BusinessCapabilityProfile;
  conversionGoals: ConversionGoal[];
  brand: BrandProfile;
  commercialData: Pick<NonNullable<Project["commercialConfig"]>, "serviceOfferings" | "catalogItems" | "locations" | "reservableUnits" | "policies">;
  verifiedFacts: Array<{ key: string; value: unknown; sourceId?: string; verificationStatus: string }>;
  mediaAssets: MediaAsset[];
  requestedSurface: "business_site" | "landing_page";
  objective?: string;
  campaignContext?: AttributionContext;
}

export interface VirouAIProvider {
  analyzeBusiness(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  generateMissingQuestions(input: MissingQuestionInput): Promise<SetupQuestion[]>;
  composeJourney(input: JourneyAIInput): Promise<AIJourneyDraftPayload>;
  composePresence(input: PresenceCompositionInput): Promise<AIPresenceDraft>;
  generateCopy(input: CopyGenerationInput): Promise<CopyGenerationResult>;
  extractSource(input: SourceExtractionInput): Promise<ExtractedBusinessSource>;
  analyzeBrand?(input: BrandAIInput): Promise<BrandAIResult>;
}

export interface StructuredAIRequest<T> {
  operation: string;
  schemaName: string;
  schema: z.ZodType<T>;
  systemPrompt: string;
  payload: unknown;
  context: AIRequestContext;
  model?: string;
  userContent?: ResponseInputContent[];
}
