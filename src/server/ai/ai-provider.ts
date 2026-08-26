import type { z } from "zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import type { AttributionContext, BrandProfile, BusinessCapabilityProfile, ConversionGoal, ExperienceCompositionInput, MediaAsset, OptimizationSuggestion, Project, ProjectCapability } from "@/types";
import type { AIPresenceDraft } from "@/features/presence/ai-presence.schema";
import type { AIJourneyDraftPayload } from "@/features/composition/composition.schema";
import type { ActivationUnderstanding, BrandAIResult, BusinessAnalysisResult, CommercialArchitecture, CopyGenerationResult, CustomVisitorActionClassification, ExtractedBusinessSource, SetupQuestion } from "@/features/ai-setup/ai-setup.schema";
import type { AIActivationDraft } from "@/features/activations/ai-activation.schema";
import type { ConversionActivation } from "@/features/activations/activation.types";
import type { BusinessShape, SuggestedSiteStructure } from "@/features/site-composer/site-composer.types";
import type { OptimizationAIExplanation } from "@/features/optimization/schema";
import type { DiscoveryPlan, DiscoveryPlanDraft } from "@/features/qualification/discovery-plan";
import type { commercialContextForAI } from "@/features/commercial-context/project-commercial-context";

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

export type ActivationUnderstandingInput = BusinessAnalysisInput;
export type CommercialArchitectureInput = BusinessAnalysisInput;

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
  discoveryPlan?: DiscoveryPlan;
  commercialArchitecture?: CommercialArchitecture;
  commercialContext?: ReturnType<typeof commercialContextForAI>;
}

export interface DiscoveryPlanningInput extends AIRequestContext {
  businessName: string;
  businessDescription: string;
  declaredObjective: string;
  primaryAction: { key: string; label: string };
  completionAction: { label: string; destination: string };
  offeringNames: string[];
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
  fileData?: string;
  mimeType?: string;
}

export interface CustomVisitorActionInput extends AIRequestContext {
  actionLabel: string;
  businessName: string;
  businessDescription: string;
  profile: BusinessCapabilityProfile;
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
export interface SiteCompositionInput extends AIRequestContext {
  instruction: string;
  target: "site" | "page";
  pageId?: string;
  businessShape: BusinessShape;
  plannerSuggestion: SuggestedSiteStructure;
  currentSite: Project["presence"];
  business: Pick<Project, "name" | "description" | "category" | "audience" | "primaryGoal" | "visualDirection" | "brand" | "businessProfile" | "conversionGoals" | "commercialConfig">;
  commercialArchitecture?: CommercialArchitecture;
  commercialContext?: ReturnType<typeof commercialContextForAI>;
}
export interface OptimizationExplanationInput extends AIRequestContext {
  project: Pick<Project, "name" | "category" | "audience" | "primaryGoal">;
  suggestion: Pick<OptimizationSuggestion, "title" | "explanation" | "evidence">;
}
export interface ActivationCompositionInput extends AIRequestContext { businessProfile: unknown; conversionGoals: Project["conversionGoals"]; catalogSummary: Array<{id:string;name:string;price?:number}>; serviceSummary:Array<{id:string;name:string}>; locations:Array<{id:string;name:string}>; presencePages:Array<{id:string;name:string}>; activeActivations:Pick<ConversionActivation,"id"|"name"|"activationType"|"startsAt"|"endsAt">[]; instruction:string }

export interface VirouAIProvider {
  analyzeBusiness(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult>;
  analyzeActivationUnderstanding(input: ActivationUnderstandingInput): Promise<ActivationUnderstanding>;
  analyzeCommercialArchitecture?(input: CommercialArchitectureInput): Promise<CommercialArchitecture>;
  generateMissingQuestions(input: MissingQuestionInput): Promise<SetupQuestion[]>;
  composeDiscoveryPlan(input: DiscoveryPlanningInput): Promise<DiscoveryPlanDraft>;
  composeJourney(input: JourneyAIInput): Promise<AIJourneyDraftPayload>;
  composePresence(input: PresenceCompositionInput): Promise<AIPresenceDraft>;
  composeSiteStructure(input: SiteCompositionInput): Promise<SuggestedSiteStructure>;
  explainOptimization(input: OptimizationExplanationInput): Promise<OptimizationAIExplanation>;
  composeActivation(input: ActivationCompositionInput): Promise<AIActivationDraft>;
  generateCopy(input: CopyGenerationInput): Promise<CopyGenerationResult>;
  extractSource(input: SourceExtractionInput): Promise<ExtractedBusinessSource>;
  analyzeBrand?(input: BrandAIInput): Promise<BrandAIResult>;
  classifyVisitorAction?(input: CustomVisitorActionInput): Promise<CustomVisitorActionClassification>;
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
