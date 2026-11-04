import { z } from "zod";

export const visualTargetSchema = z.enum(["hero", "offer", "card", "social", "story", "og"]);
export const visualLayoutSchema = z.enum(["split", "photo", "offer", "editorial", "product", "minimal", "full_bleed", "product_hero", "minimal_premium", "promotional", "lifestyle"]);
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const designKitSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1).max(160),
  primary: colorSchema,
  secondary: colorSchema,
  accent: colorSchema,
  surface: colorSchema,
  ink: colorSchema,
  font: z.enum(["sans", "serif"]),
  photoStyle: z.enum(["natural", "studio", "editorial"]),
  logoAssetId: z.string().uuid().nullable(),
  referenceArtworkId: z.string().uuid().nullable(),
});
export const designKitEditSchema = designKitSchema.pick({ primary: true, secondary: true, accent: true, surface: true, ink: true, font: true, photoStyle: true }).partial();
export const visualBriefSchema = z.object({
  target: visualTargetSchema,
  headline: z.string().trim().min(2).max(120).optional(),
  subheading: z.string().trim().max(240).optional(),
  cta: z.string().trim().max(70).optional(),
  price: z.string().trim().max(50).optional(),
  offeringId: z.string().uuid().optional(),
  imageAssetId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().max(160).optional(),
});
export const artDirectionSchema = z.object({
  commercialObjective: z.string().max(180), creativeConcept: z.string().max(180), protagonist: z.string().max(180),
  visualStyle: z.string().max(180), composition: z.string().max(240), typography: z.string().max(180),
  elementDistribution: z.string().max(240), paletteApplication: z.string().max(180), photography: z.string().max(240),
  brandPlacement: z.string().max(160), restrictions: z.array(z.string().max(180)).max(12),
  imageZone: z.enum(["full", "right", "left", "center", "none"]), textZone: z.enum(["top", "bottom", "left", "right", "center"]),
  imageFocalPoint: z.enum(["left", "center", "right"]), treatment: z.enum(["natural", "dark_overlay", "light_overlay", "cutout"]),
  motif: z.enum(["none", "rule", "frame", "disc"]).optional(),
  typeScale: z.enum(["restrained", "balanced", "expressive"]).optional(),
  imageScale: z.enum(["detail", "balanced", "dominant"]).optional(),
  medium: z.enum(["photography", "illustration", "graphic", "mixed"]).optional(),
  revisionNote: z.string().trim().max(400).optional(),
});
export const visualSpecSchema = z.object({
  target: visualTargetSchema,
  layout: visualLayoutSchema,
  headline: z.string().trim().min(1).max(120),
  subheading: z.string().trim().max(240),
  cta: z.string().trim().max(70),
  price: z.string().trim().max(50),
  subject: z.string().max(240).default(""),
  imageAssetId: z.string().uuid().nullable(),
  imagePrompt: z.string().max(2000),
  kitVersion: z.number().int().positive(),
  variant: z.number().int().min(0).max(2),
  direction: artDirectionSchema.optional(),
  directionSource: z.enum(["ai", "rules"]).optional(),
});
export const visualEditSchema = z.object({ currentVersion: z.number().int().positive(), patch: visualSpecSchema.pick({ headline: true, subheading: true, cta: true, price: true, layout: true, imageAssetId: true, direction: true }).partial() });
export type DesignKit = z.infer<typeof designKitSchema>;
export type ArtDirection = z.infer<typeof artDirectionSchema>;
export type VisualSpec = z.infer<typeof visualSpecSchema>;
export type VisualTarget = z.infer<typeof visualTargetSchema>;

export const visualSizes: Record<VisualTarget, { width: number; height: number }> = {
  hero: { width: 1600, height: 900 }, offer: { width: 1200, height: 1200 },
  card: { width: 1080, height: 1350 }, social: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 }, og: { width: 1200, height: 630 },
};
