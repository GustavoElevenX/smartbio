import { z } from "zod";
import { businessCapabilityProfileSchema } from "@/features/business-understanding/business-profile.schema";
import { capabilityKeySchema } from "@/features/composition/composition.schema";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";
import { validateSetupSalesChannel } from "@/features/ai-setup/setup-sales-channel";
import { discoveryPlanSchema } from "@/features/qualification/discovery-plan";
import { setupAnswerContextAuditSchema, setupAnswerContextSchema } from "@/features/ai-setup/setup-answer-interpretation";

export const structuredJourneyQuestionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(240),
  type: z.enum(["text", "textarea", "select", "radio", "checkbox"]),
  options: z.array(z.string().trim().min(1).max(160)).max(10).optional(),
  purpose: z.enum(["need", "signal", "context", "constraint", "explicit_choice"]),
  required: z.boolean(),
});

export const dataOriginSchema = z.enum(["user", "website", "document", "logo_analysis", "ai_inference", "generated_copy", "system_default"]);
export const verificationStatusSchema = z.enum(["verified", "needs_confirmation", "missing", "invalid"]);

export const dataRequirementSchema = z.object({
  id: z.string(),
  key: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(180),
  capability: z.union([capabilityKeySchema, z.enum(["brand", "project"])]),
  status: verificationStatusSchema,
  severity: z.enum(["blocking", "warning", "optional"]),
  value: z.unknown().optional(),
  origin: dataOriginSchema.optional(),
  sourceId: z.string().optional(),
  reason: z.string().trim().min(1).max(400),
  actionLabel: z.string().trim().max(100).optional(),
  actionPath: z.string().trim().max(300).optional(),
});

export const setupQuestionSchema = z.object({
  id: z.string(),
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(360).optional(),
  type: z.enum(["text", "textarea", "single_choice", "multiple_choice", "number", "money", "phone", "url", "address", "date", "time", "upload"]),
  options: z.array(z.object({ label: z.string().min(1).max(120), value: z.string().min(1).max(120), description: z.string().max(240).optional() })).max(8).optional(),
  required: z.boolean(),
  reason: z.string().trim().min(1).max(360),
  capability: capabilityKeySchema.optional(),
  priority: z.number().int().min(0).max(100),
  suggestedAnswer: z.string().trim().min(1).max(2000).optional(),
  structuredAnswer: z.array(structuredJourneyQuestionSchema).min(1).max(6).optional(),
});

export const aiSetupQuestionSchema = setupQuestionSchema.extend({
  description: setupQuestionSchema.shape.description.unwrap().nullable(),
  options: z.array(z.object({ label: z.string().min(1).max(120), value: z.string().min(1).max(120), description: z.string().max(240).nullable() })).max(8).nullable(),
  capability: capabilityKeySchema.nullable(),
  suggestedAnswer: setupQuestionSchema.shape.suggestedAnswer.unwrap().nullable(),
  structuredAnswer: z.array(structuredJourneyQuestionSchema.extend({ options: structuredJourneyQuestionSchema.shape.options.unwrap().nullable() })).min(1).max(6).nullable(),
});

export const extractedFactSchema = z.object({
  key: z.string().min(1).max(160),
  value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
  origin: dataOriginSchema,
  sourceId: z.string(),
  evidenceExcerpt: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
  verificationStatus: verificationStatusSchema,
});

const extractedAttributeSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.string().max(1000),
});

const extractedEntitySchema = z.object({
  name: z.string().max(240).nullable(),
  description: z.string().max(1200).nullable(),
  attributes: z.array(extractedAttributeSchema).max(30),
});

export const brandPaletteSchema = z.object({
  sourceColors: z.array(z.string()).max(6),
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  background: z.string(),
  surface: z.string(),
  surfaceElevated: z.string(),
  foreground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  border: z.string(),
  success: z.string(),
  warning: z.string(),
  destructive: z.string(),
  gradientStart: z.string(),
  gradientEnd: z.string(),
});

export const brandIdentitySchema = z.object({
  sourceId: z.string(),
  fileName: z.string().min(1).max(240),
  extractedColors: z.array(z.string()).min(1).max(6),
  activePalette: brandPaletteSchema,
  paletteVariations: z.array(z.object({
    name: z.enum(["Fiel", "Equilibrada", "Ousada"]),
    palette: brandPaletteSchema,
  })).length(3),
  brandPersonality: z.array(z.string().min(1).max(80)).max(6),
  visualDirection: z.string().min(1).max(240),
  density: z.enum(["compact", "balanced", "spacious"]),
  contrast: z.enum(["soft", "balanced", "strong"]),
  typographySuggestion: z.string().max(160),
  imageUsage: z.string().max(240),
  analysisMetadata: z.object({
    confidence: z.number().min(0).max(1),
    orientation: z.enum(["horizontal", "vertical", "square"]),
    luminance: z.enum(["light", "dark", "mixed"]),
    colorCount: z.number().int().min(1).max(6),
    aiEnhanced: z.boolean(),
  }),
});

export const extractedBusinessSourceSchema = z.object({
  summary: z.string().max(1000),
  facts: z.array(extractedFactSchema).max(200),
  services: z.array(extractedEntitySchema).max(100),
  products: z.array(extractedEntitySchema).max(300),
  categories: z.array(z.string().max(160)).max(100),
  schedules: z.array(extractedEntitySchema).max(100),
  prices: z.array(extractedEntitySchema).max(200),
  locations: z.array(extractedEntitySchema).max(100),
  openingHours: z.array(extractedEntitySchema).max(100),
  contacts: z.array(extractedEntitySchema).max(100),
  policies: z.array(z.string().max(1000)).max(100),
  accommodations: z.array(extractedEntitySchema).max(100),
  reservableUnits: z.array(extractedEntitySchema).max(100),
  frequentlyAskedQuestions: z.array(extractedEntitySchema).max(100),
  brandStatements: z.array(extractedEntitySchema).max(100),
  destinations: z.array(extractedEntitySchema).max(100),
  detectedLinks: z.array(z.object({
    url: z.string().trim().max(1000),
    label: z.string().trim().max(240),
    classification: z.enum(["whatsapp", "menu", "location", "quote", "commercial_b2b", "delivery", "scheduling", "site", "catalog", "other"]),
    external: z.boolean(),
  })).max(60).nullable().default(null),
  warnings: z.array(z.string().max(400)).max(50),
});

export const setupDraftInputSchema = z.object({
  requestedSurface: z.enum(["business_site", "landing_page", "conversion_direct", "recommend"]).optional(),
  businessName: z.string().trim().max(160),
  description: z.string().trim().max(4000),
  offeringType: z.enum(["products", "services", "both"]).optional(),
  offerDetails: z.string().trim().max(6000).optional(),
  resaleAvailable: z.boolean().optional(),
  resaleDetails: z.string().trim().max(2000).optional(),
  salesChannel: z.enum(["whatsapp", "phone", "link", "in_person", "other"]).optional(),
  salesDestination: z.string().trim().max(1000).optional(),
  websiteUrl: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(40).optional(),
  logoReference: z.string().trim().max(500).optional(),
  brandIdentity: brandIdentitySchema.optional(),
});

export const minimumBusinessContextLength = 5;

export const setupInitialInputSchema = setupDraftInputSchema.extend({
  businessName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(minimumBusinessContextLength).max(4000),
  websiteUrl: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(40).refine(
    (value) => validateSetupPhone(value).valid,
    "Confira o número. Use DDD + telefone.",
  ).optional(),
}).superRefine((input, context) => {
  if (!input.salesChannel) return; // Sessões antigas continuam legíveis.
  const error = validateSetupSalesChannel(input);
  if (error) context.addIssue({ code: "custom", message: error, path: [input.salesChannel === "whatsapp" || input.salesChannel === "phone" ? "phone" : "salesDestination"] });
});

export const visitorActionKeySchema = z.enum([
  "order", "buy", "view_products", "quote", "schedule", "reserve",
  "contact", "find_location", "support", "resale", "recommendation", "other",
]);

export const activationDecisionSourceSchema = z.enum([
  "contextual_ai",
  "business_confirmed",
  "deterministic_fallback",
]);

export const commercialEvidenceRefSchema = z.object({
  sourceId: z.string().trim().min(1).max(160),
  origin: z.enum(["user", "website", "document", "link_bio", "instagram", "logo_analysis", "ai_inference", "system_fallback"]),
  excerpt: z.string().trim().min(1).max(500).nullable(),
  confidence: z.number().min(0).max(1),
});

export const commercialChannelSchema = z.object({
  id: z.string().trim().min(1).max(160),
  type: z.enum(["whatsapp", "external_url", "email", "phone", "native"]),
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().max(1000).nullable(),
  purpose: z.string().trim().max(240).nullable(),
  isFallback: z.boolean(),
  evidence: z.array(commercialEvidenceRefSchema).max(12),
  confidence: z.number().min(0).max(1),
});

export const journeyCompletionTypeSchema = z.enum(["whatsapp", "external_url", "phone", "email", "native"]);

export const architectureResolutionTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("channel_value"),
    channelId: z.string().trim().min(1).max(160).nullable(),
    intentId: z.string().trim().min(1).max(160),
    channelType: z.enum(["whatsapp", "external_url", "phone", "email"]),
  }),
  z.object({
    type: z.literal("location_channel_mapping"),
    intentId: z.string().trim().min(1).max(160),
    locationIds: z.array(z.string().trim().min(1).max(160)).max(100),
    channelType: z.enum(["whatsapp", "phone", "external_url", "email"]),
  }),
  z.object({
    type: z.literal("completion_strategy"),
    blueprintId: z.string().trim().min(1).max(160),
    acceptedStrategies: z.array(z.enum(["fixed", "by_location", "by_answer", "external_url", "native"])).min(1).max(5),
  }),
  z.object({
    type: z.literal("external_url"),
    blueprintId: z.string().trim().min(1).max(160),
    intentId: z.string().trim().min(1).max(160),
  }),
  z.object({
    type: z.literal("required_field"),
    blueprintId: z.string().trim().min(1).max(160),
    fieldKey: z.string().trim().min(1).max(160),
  }),
]);

export const commercialArchitectureSchema = z.object({
  status: z.enum(["ready", "needs_confirmation", "degraded"]),
  confidence: z.number().min(0).max(1),
  businessSummary: z.object({
    whatItSells: z.string().trim().min(1).max(4000),
    commercialModel: z.string().trim().min(1).max(600),
    evidence: z.array(commercialEvidenceRefSchema).max(16),
  }),
  offerings: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    name: z.string().trim().min(1).max(160),
    kind: z.enum(["product", "service", "plan", "package", "other"]),
    description: z.string().trim().max(1000).nullish(),
    price: z.number().nonnegative().nullish(),
    priceMode: z.enum(["fixed", "starting_at", "on_request", "free"]).nullish(),
    variants: z.array(z.object({
      id: z.string().trim().min(1).max(160),
      name: z.string().trim().min(1).max(160),
      priceDelta: z.number().nullable(),
      isAvailable: z.boolean().nullable(),
    })).max(200).nullish(),
    evidence: z.array(commercialEvidenceRefSchema).max(12),
    confidence: z.number().min(0).max(1),
  })).max(200),
  audienceContexts: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    label: z.string().trim().min(1).max(160),
    description: z.string().trim().max(500).nullable(),
    evidence: z.array(commercialEvidenceRefSchema).max(12),
    confidence: z.number().min(0).max(1),
  })).max(30),
  channels: z.array(commercialChannelSchema).max(50),
  locations: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    label: z.string().trim().min(1).max(160),
    address: z.string().trim().max(500).nullable(),
    hoursText: z.string().trim().max(500).nullish(),
    openingHours: z.array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: z.string().regex(/^\d{2}:\d{2}$/), closesAt: z.string().regex(/^\d{2}:\d{2}$/), isClosed: z.boolean() })).max(21).nullish(),
    supportsDelivery: z.boolean().nullish(),
    supportsPickup: z.boolean().nullish(),
    supportsInPerson: z.boolean().nullish(),
    deliveryRadiusKm: z.number().positive().nullish(),
    offeringIds: z.array(z.string()).max(200).nullish(),
    channelIds: z.array(z.string().trim().min(1).max(160)).max(12),
    evidence: z.array(commercialEvidenceRefSchema).max(12),
    confidence: z.number().min(0).max(1),
  })).max(100),
  intents: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    semanticKey: visitorActionKeySchema.nullable(),
    label: z.string().trim().min(1).max(100),
    visitorNeed: z.string().trim().min(1).max(500),
    priority: z.number().int().min(0).max(100),
    visibleOnEntry: z.boolean(),
    evidence: z.array(commercialEvidenceRefSchema).max(12),
    confidence: z.number().min(0).max(1),
  })).max(20),
  journeyBlueprints: z.array(z.object({
    id: z.string().trim().min(1).max(160),
    intentId: z.string().trim().min(1).max(160),
    objective: z.string().trim().min(1).max(500),
    mode: z.enum(["direct_external", "direct_contact", "routing", "catalog", "qualification", "quote", "scheduling", "reservation", "guided_flow", "hybrid"]),
    steps: z.array(z.object({
      purpose: z.string().trim().min(1).max(400),
      expectedCapability: capabilityKeySchema.nullable(),
      collects: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
      title: z.string().trim().min(1).max(120).nullish(),
      fields: z.array(z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(80),
        label: z.string().trim().min(1).max(120),
        type: z.enum(["text", "email", "phone", "number", "textarea", "select", "radio", "date", "time", "url"]),
        required: z.boolean(),
        options: z.array(z.string().trim().min(1).max(120)).max(30),
        showWhen: z.object({ field: z.string().min(1).max(80), values: z.array(z.string()).min(1).max(30) }).nullable(),
      })).max(20).nullish(),
      usesOfferings: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
      usesLocations: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
    })).max(12),
    completion: z.object({
      type: journeyCompletionTypeSchema,
      channelId: z.string().trim().min(1).max(160).nullable(),
      destinationStrategy: z.enum(["fixed", "by_location", "by_answer", "external_url", "native"]),
      handoffSummary: z.boolean().default(false),
    }),
    requiredFacts: z.array(z.object({
      key: z.string().trim().min(1).max(160),
      label: z.string().trim().min(1).max(180),
      reason: z.string().trim().min(1).max(400),
      affects: z.string().trim().min(1).max(240),
      severity: z.enum(["blocking", "warning"]).default("blocking"),
      resolutionTarget: architectureResolutionTargetSchema.nullable(),
    })).max(20),
    assumptions: z.array(z.string().trim().min(1).max(400)).max(20),
    confidence: z.number().min(0).max(1),
  })).max(20),
  issues: z.array(z.string().trim().min(1).max(400)).max(50),
});

export const activationUnderstandingSchema = z.object({
  status: z.enum(["ready", "needs_confirmation", "degraded"]),
  source: activationDecisionSourceSchema,
  declaredObjective: z.string().trim().min(1).max(600),
  primaryAction: z.object({
    key: visitorActionKeySchema,
    label: z.string().trim().min(1).max(80),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string().trim().min(1).max(500)).max(8),
    source: activationDecisionSourceSchema,
  }),
  secondaryActions: z.array(z.object({
    key: visitorActionKeySchema,
    label: z.string().trim().min(1).max(80),
    confidence: z.number().min(0).max(1),
    source: activationDecisionSourceSchema,
  })).max(7),
  completionAction: z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    destination: z.enum(["whatsapp", "email", "phone", "native", "external_url"]),
    confidence: z.number().min(0).max(1),
    source: activationDecisionSourceSchema,
  }),
  offerings: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    kind: z.enum(["product", "service", "plan", "package", "other"]),
    evidence: z.string().trim().min(1).max(500),
    confidence: z.number().min(0).max(1),
    source: activationDecisionSourceSchema,
  })).max(100),
  needsAssistedDiscovery: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string().trim().min(1).max(400)).max(40),
});

export const businessAnalysisResultSchema = z.object({
  profile: businessCapabilityProfileSchema,
  confirmedFacts: z.array(extractedFactSchema).max(200),
  inferences: z.array(z.string().max(400)).max(40),
  missingInformation: z.array(z.string().max(300)).max(60),
  inconsistencies: z.array(z.string().max(400)).max(40),
  requirements: z.array(dataRequirementSchema).max(100),
});

export const aiBusinessAnalysisResultSchema = businessAnalysisResultSchema.extend({
  profile: businessCapabilityProfileSchema.extend({
    businessRules: z.array(businessCapabilityProfileSchema.shape.businessRules.element.extend({
      value: z.union([z.string().max(500), z.number(), z.boolean()]).nullable(),
    })).max(30),
    analysisMetadata: businessCapabilityProfileSchema.shape.analysisMetadata.unwrap().nullable(),
  }),
  requirements: z.array(dataRequirementSchema.extend({
    value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
    origin: dataOriginSchema.nullable(),
    sourceId: z.string().nullable(),
    actionLabel: z.string().max(100).nullable(),
    actionPath: z.string().max(300).nullable(),
  })).max(100),
});

export const customVisitorActionSemanticKeySchema = z.enum([
  "order", "buy", "view_products", "quote", "schedule", "reserve",
  "contact", "find_location", "support", "resale", "recommendation",
]);

export const visitorActionSelectionSchema = z.object({
  key: visitorActionKeySchema,
  label: z.string().trim().min(1).max(80),
  isPrimary: z.boolean(),
  semanticKey: customVisitorActionSemanticKeySchema.optional(),
  source: activationDecisionSourceSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.array(z.string().trim().min(1).max(500)).max(8).optional(),
  confirmedByBusiness: z.boolean().optional(),
});

export const customVisitorActionClassificationSchema = z.object({
  key: customVisitorActionSemanticKeySchema,
  confidence: z.number().min(0).max(1),
  reasoning: z.string().trim().min(1).max(240),
});

export const sourceReferenceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(240),
  type: z.enum(["website", "text", "pdf", "image", "csv"]),
  status: z.enum(["pending", "uploaded", "processing", "processed", "failed"]),
  processingError: z.string().max(500).optional(),
});

export const aiSetupSessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().optional(),
  status: z.enum(["collecting", "analyzing", "waiting_answers", "generating", "review", "completed", "failed"]),
  initialInput: setupDraftInputSchema,
  extractedProfile: businessCapabilityProfileSchema.optional(),
  activationUnderstanding: activationUnderstandingSchema.optional(),
  commercialArchitecture: commercialArchitectureSchema.optional(),
  architectureReviewed: z.boolean().optional(),
  architectureEdited: z.boolean().optional(),
  visitorActions: z.array(visitorActionSelectionSchema).max(8).default([]),
  actionsConfirmed: z.boolean().default(false),
  answers: z.record(z.string(), z.unknown()),
  answerContexts: z.array(setupAnswerContextSchema).max(100).optional(),
  answerContextAudit: setupAnswerContextAuditSchema.optional(),
  missingRequirements: z.array(dataRequirementSchema),
  questions: z.array(setupQuestionSchema).max(5).default([]),
  discoveryPlan: discoveryPlanSchema.optional(),
  sources: z.array(sourceReferenceSchema).max(10).default([]),
  projectDraft: z.unknown().optional(),
  lastError: z.string().optional(),
  usedFallback: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const copyGenerationResultSchema = z.object({ suggestions: z.array(z.string().min(1).max(500)).min(1).max(5) });
export const brandAIResultSchema = z.object({
  personality: z.array(z.string().min(1).max(80)).max(6),
  visualDirection: z.string().min(1).max(240),
  density: z.enum(["compact", "balanced", "spacious"]),
  borderStyle: z.string().max(120),
  contrast: z.enum(["soft", "balanced", "strong"]),
  toneOfVoice: z.string().max(240),
  typographySuggestion: z.string().max(160),
  imageUsage: z.string().max(240),
});

export type AISetupSession = z.infer<typeof aiSetupSessionSchema>;
export type SetupInitialInput = z.infer<typeof setupInitialInputSchema>;
export type SetupDraftInput = z.infer<typeof setupDraftInputSchema>;
export type SetupQuestion = z.infer<typeof setupQuestionSchema>;
export type ExtractedBusinessSource = z.infer<typeof extractedBusinessSourceSchema>;
export type BusinessAnalysisResult = z.infer<typeof businessAnalysisResultSchema>;
export type CopyGenerationResult = z.infer<typeof copyGenerationResultSchema>;
export type BrandAIResult = z.infer<typeof brandAIResultSchema>;
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
export type VisitorActionSelection = z.infer<typeof visitorActionSelectionSchema>;
export type CustomVisitorActionClassification = z.infer<typeof customVisitorActionClassificationSchema>;
export type ActivationUnderstanding = z.infer<typeof activationUnderstandingSchema>;
export type ActivationDecisionSource = z.infer<typeof activationDecisionSourceSchema>;
export type CommercialArchitecture = z.infer<typeof commercialArchitectureSchema>;
export type CommercialEvidenceRef = z.infer<typeof commercialEvidenceRefSchema>;
export type ArchitectureResolutionTarget = z.infer<typeof architectureResolutionTargetSchema>;
export type JourneyCompletionType = z.infer<typeof journeyCompletionTypeSchema>;
