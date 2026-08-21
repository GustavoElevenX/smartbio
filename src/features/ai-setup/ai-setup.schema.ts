import { z } from "zod";
import { businessCapabilityProfileSchema } from "@/features/business-understanding/business-profile.schema";
import { capabilityKeySchema } from "@/features/composition/composition.schema";

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
  warnings: z.array(z.string().max(400)).max(50),
});

export const businessAnalysisResultSchema = z.object({
  profile: businessCapabilityProfileSchema,
  confirmedFacts: z.array(extractedFactSchema).max(200),
  inferences: z.array(z.string().max(400)).max(40),
  missingInformation: z.array(z.string().max(300)).max(60),
  inconsistencies: z.array(z.string().max(400)).max(40),
  requirements: z.array(dataRequirementSchema).max(100),
});

export const setupInitialInputSchema = z.object({
  requestedSurface: z.enum(["business_site", "landing_page", "conversion_direct", "recommend"]).optional(),
  businessName: z.string().trim().min(2).max(160),
  description: z.string().trim().min(15).max(4000),
  websiteUrl: z.url().optional(),
  phone: z.string().trim().max(40).optional(),
  logoReference: z.string().trim().max(500).optional(),
  brandIdentity: brandIdentitySchema.optional(),
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
  initialInput: setupInitialInputSchema,
  extractedProfile: businessCapabilityProfileSchema.optional(),
  answers: z.record(z.string(), z.unknown()),
  missingRequirements: z.array(dataRequirementSchema),
  questions: z.array(setupQuestionSchema).max(5).default([]),
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
export type SetupQuestion = z.infer<typeof setupQuestionSchema>;
export type ExtractedBusinessSource = z.infer<typeof extractedBusinessSourceSchema>;
export type BusinessAnalysisResult = z.infer<typeof businessAnalysisResultSchema>;
export type CopyGenerationResult = z.infer<typeof copyGenerationResultSchema>;
export type BrandAIResult = z.infer<typeof brandAIResultSchema>;
export type BrandIdentity = z.infer<typeof brandIdentitySchema>;
export type SourceReference = z.infer<typeof sourceReferenceSchema>;
