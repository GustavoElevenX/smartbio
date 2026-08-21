import { z } from "zod";
import { presenceSectionContentSchemas } from "@/features/presence/presence-section.schema";
import type { PresenceSectionType } from "@/features/presence/presence.types";

const sectionTypes = Object.keys(presenceSectionContentSchemas) as [PresenceSectionType, ...PresenceSectionType[]];

export const suggestSiteStructureInputSchema = z.object({
  instruction: z.string().trim().max(2_000).default(""),
  intent: z.enum(["suggest_structure", "create_page", "add_section", "reorganize", "improve_cta", "focus_offer", "create_landing"]).default("suggest_structure"),
  target: z.enum(["site", "page"]),
  pageId: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (value.target === "page" && !value.pageId) context.addIssue({ code: "custom", message: "pageId é obrigatório para sugestões de página.", path: ["pageId"] });
});

export const suggestedSectionSchema = z.object({
  sectionType: z.enum(sectionTypes),
  purpose: z.string().min(1).max(300),
  title: z.string().min(1).max(180).optional(),
  description: z.string().max(600).optional(),
  suggestedContent: z.record(z.string(), z.unknown()),
  sourceBindings: z.array(z.string()).max(30),
  conversionGoalId: z.string().optional(),
  priority: z.enum(["essential", "recommended", "optional"]),
  reasoning: z.string().min(1).max(600),
}).superRefine((section, context) => {
  const parsed = presenceSectionContentSchemas[section.sectionType].safeParse(section.suggestedContent);
  if (!parsed.success && Object.keys(section.suggestedContent).length > 0) {
    parsed.error.issues.forEach((issue) => context.addIssue({ ...issue, path: ["suggestedContent", ...issue.path] }));
  }
});

export const suggestedSiteStructureSchema = z.object({
  reasoning: z.string().min(1).max(2_000),
  pages: z.array(z.object({
    type: z.enum(["home", "landing", "page"]),
    name: z.string().min(1).max(100),
    purpose: z.string().min(1).max(400),
    pathSuggestion: z.string().startsWith("/"),
    conversionGoalId: z.string().optional(),
    sections: z.array(suggestedSectionSchema).max(20),
  })).min(1).max(12),
  primaryConversionGoals: z.array(z.string()).max(10),
  catalogStrategy: z.enum(["inline_all", "featured_then_catalog", "categories_then_catalog", "search_first"]),
  contentStrategy: z.array(z.string()).max(20),
  visualDirection: z.array(z.string()).max(20),
  warnings: z.array(z.string()).max(20),
});

export const applySiteProposalInputSchema = z.object({
  proposalId: z.string().min(1),
  selectedOperations: z.array(z.string()).min(1).max(100),
  expectedVersion: z.number().int().min(0),
});
