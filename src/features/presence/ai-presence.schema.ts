import { z } from "zod";
import { dataRequirementSchema } from "@/features/ai-setup/ai-setup.schema";
import { presenceSectionContentSchemas, presenceSectionStyleSchema } from "./presence-section.schema";
import type { PresenceSectionType } from "./presence.types";

export const aiPresenceSectionDraftSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  type: z.enum(Object.keys(presenceSectionContentSchemas) as [PresenceSectionType, ...PresenceSectionType[]]),
  anchor: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).optional(), eyebrow: z.string().max(100).optional(), title: z.string().max(180).optional(), description: z.string().max(1000).optional(),
  content: z.record(z.string(), z.unknown()), style: presenceSectionStyleSchema.default({}), rationale: z.string().max(500).optional(), sourceIds: z.array(z.string()).max(30).default([]), verificationStatus: z.enum(["unverified", "confirmed", "source_verified"]).default("unverified"),
}).superRefine((section, context) => { const parsed = presenceSectionContentSchemas[section.type].safeParse(section.content); if (!parsed.success) parsed.error.issues.forEach((issue) => context.addIssue({ ...issue, path: ["content", ...issue.path] })); });

export const aiPresenceDraftSchema = z.object({
  page: z.object({ name: z.string().min(1).max(100), type: z.enum(["home", "landing", "page"]), title: z.string().max(180).optional(), description: z.string().max(1000).optional(), seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(170).optional() }),
  sections: z.array(aiPresenceSectionDraftSchema).min(2).max(20), rationale: z.array(z.string().max(500)).max(20), missingRequirements: z.array(dataRequirementSchema).max(50),
});

export type AIPresenceDraft = z.infer<typeof aiPresenceDraftSchema>;
