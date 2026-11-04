import { z } from "zod";

export const contentBriefSchema = z.object({
  objective: z.enum(["venda", "autoridade", "engajamento", "prova_social", "oferta"]),
  format: z.enum(["carousel", "single"]).default("carousel"),
  theme: z.string().trim().min(3).max(300),
  offeringId: z.string().max(200).optional(),
  desiredSlides: z.number().int().min(1).max(8).default(5),
});
export const slideSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.enum(["hook", "value", "explanation", "proof", "offer", "cta"]),
  headline: z.string().trim().min(1).max(65),
  body: z.string().trim().max(160).default(""),
  visualPrompt: z.string().trim().max(2048).default(""),
  layoutId: z.enum(["editorial", "split", "photo", "statement", "closing"]).default("editorial"),
  imageAssetId: z.string().uuid().nullable().default(null),
  imagePosition: z.enum(["centre", "north", "south", "east", "west"]).default("centre"),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#07172F"),
  textColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
});
export const contentPlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  audience: z.string().max(240),
  factualBasis: z.array(z.object({ fact: z.string().max(400), origin: z.string().max(120) })).max(30),
  unsupportedClaims: z.array(z.string().max(300)).max(20),
  slides: z.array(slideSchema).min(1).max(8),
  caption: z.string().max(2200),
  callToAction: z.string().max(200),
});
export const editContentSchema = z.object({
  currentVersion: z.number().int().positive(),
  slides: z.array(slideSchema).min(1).max(8),
  caption: z.string().max(2200),
});
export type ContentBrief = z.infer<typeof contentBriefSchema>;
export type ContentSlide = z.infer<typeof slideSchema>;
export type ContentPlan = z.infer<typeof contentPlanSchema>;
