import { z } from "zod";
import { presenceActionSchema } from "./presence-action.schema";
import { presenceSectionContentSchemas, presenceSectionStyleSchema } from "./presence-section.schema";
import type { PresenceSectionType } from "./presence.types";

export const presencePageSettingsSchema = z.object({
  header: z.object({ enabled: z.boolean(), sticky: z.boolean(), showLogo: z.boolean(), showNavigation: z.boolean(), primaryAction: presenceActionSchema.optional() }),
  footer: z.object({ enabled: z.boolean(), showLogo: z.boolean(), showSocialLinks: z.boolean(), showPolicies: z.boolean(), showVirouBranding: z.boolean() }),
  layout: z.object({ maxWidth: z.enum(["md", "lg", "xl", "full"]).optional(), sectionSpacing: z.enum(["compact", "normal", "airy"]).optional() }),
  conversionPresentation: z.object({ mode: z.enum(["overlay", "replace"]) }),
});

const baseSectionSchema = z.object({
  id: z.string().min(1), pageId: z.string().min(1), key: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/),
  type: z.enum(Object.keys(presenceSectionContentSchemas) as [PresenceSectionType, ...PresenceSectionType[]]),
  anchor: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(), eyebrow: z.string().max(100).optional(),
  title: z.string().max(180).optional(), description: z.string().max(1000).optional(), content: z.record(z.string(), z.unknown()),
  style: presenceSectionStyleSchema, settings: z.record(z.string(), z.unknown()), order: z.number().int().min(0), isActive: z.boolean(),
});

export const presenceSectionSchema = baseSectionSchema.superRefine((section, context) => {
  const parsed = presenceSectionContentSchemas[section.type].safeParse(section.content);
  if (!parsed.success) parsed.error.issues.forEach((issue) => context.addIssue({ ...issue, path: ["content", ...issue.path] }));
});

export const presencePageSchema = z.object({
  id: z.string().min(1), projectId: z.string().min(1), key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/), name: z.string().trim().min(1).max(100),
  type: z.enum(["home", "landing", "page"]), path: z.string().startsWith("/"), title: z.string().max(180).optional(), description: z.string().max(1000).optional(),
  seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(170).optional(), ogImageAssetId: z.string().optional(), defaultConversionGoalId: z.string().optional(),
  isHome: z.boolean(), isActive: z.boolean(), isIndexable: z.boolean(), version: z.number().int().positive().optional(), settings: presencePageSettingsSchema,
  sections: z.array(presenceSectionSchema).max(80), createdAt: z.string().optional(), updatedAt: z.string().optional(),
});
