import { z } from "zod";
import { presenceActionSchema } from "./presence-action.schema";
import type { PresenceSectionType } from "./presence.types";

const verificationSchema = z.enum(["unverified", "confirmed", "source_verified"]);
const featureItemSchema = z.object({ id: z.string().min(1), title: z.string().min(1), description: z.string(), iconKey: z.string().optional(), mediaAssetId: z.uuid().optional() });
const actionPair = { primaryAction: presenceActionSchema.optional(), secondaryAction: presenceActionSchema.optional() };

export const presenceSectionContentSchemas = {
  hero: z.object({ media: z.object({ assetId: z.uuid().optional(), position: z.enum(["background", "right", "left"]).default("right") }).optional(), ...actionPair, badges: z.array(z.string().max(60)).max(4).default([]), alignment: z.enum(["left", "center"]).default("left") }),
  rich_text: z.object({ body: z.string().max(12000), action: presenceActionSchema.optional() }),
  benefits: z.object({ items: z.array(featureItemSchema).min(3).max(12) }),
  feature_grid: z.object({ items: z.array(featureItemSchema).min(3).max(12), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3) }),
  services: z.object({ dataSource: z.enum(["commercial_data", "selected"]).default("commercial_data"), serviceIds: z.array(z.uuid()).optional(), layout: z.enum(["grid", "list", "featured"]).default("grid"), showPrice: z.boolean().default(true), itemAction: presenceActionSchema.optional() }),
  products: z.object({ categoryIds: z.array(z.uuid()).optional(), itemIds: z.array(z.uuid()).optional(), layout: z.enum(["grid", "featured", "carousel"]).default("grid"), maxItems: z.number().int().min(1).max(24).default(8), showPrice: z.boolean().default(true), itemGoalId: z.string().optional() }),
  about: z.object({ body: z.string().max(8000), bullets: z.array(z.string().max(180)).max(12).default([]), mediaAssetId: z.uuid().optional(), action: presenceActionSchema.optional() }),
  stats: z.object({ items: z.array(z.object({ id: z.string(), value: z.string().max(40), label: z.string().max(100), verificationStatus: verificationSchema, sourceId: z.string().optional() })).max(8) }),
  logo_cloud: z.object({ assetIds: z.array(z.uuid()).max(20), caption: z.string().max(160).optional() }),
  gallery: z.object({ assetIds: z.array(z.uuid()).max(30), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3), lightbox: z.boolean().default(true) }),
  portfolio: z.object({ assetIds: z.array(z.uuid()).max(30), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3), lightbox: z.boolean().default(true) }),
  testimonials: z.object({ items: z.array(z.object({ id: z.string(), quote: z.string().max(1200), author: z.string().optional(), role: z.string().optional(), company: z.string().optional(), avatarAssetId: z.uuid().optional(), verificationStatus: verificationSchema, sourceId: z.string().optional() })).max(12) }),
  faq: z.object({ items: z.array(z.object({ id: z.string(), question: z.string().max(240), answer: z.string().max(3000) })).max(30) }),
  pricing: z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), priceLabel: z.string().optional(), description: z.string().optional(), features: z.array(z.string()).max(20), action: presenceActionSchema.optional(), highlighted: z.boolean().optional(), verificationStatus: verificationSchema })).max(8) }),
  locations: z.object({ locationIds: z.array(z.uuid()).optional(), showOpeningHours: z.boolean().default(true), showPhone: z.boolean().default(true), showMapLink: z.boolean().default(true), nearestAction: presenceActionSchema.optional() }),
  contact: z.object({ email: z.email().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), address: z.string().optional(), socialLinks: z.array(z.object({ label: z.string(), url: z.url() })).max(8).default([]), action: presenceActionSchema.optional() }),
  video: z.object({ url: z.url(), caption: z.string().max(300).optional(), posterAssetId: z.uuid().optional() }),
  conversion_cta: z.object({ primaryAction: presenceActionSchema, secondaryAction: presenceActionSchema.optional() }),
  divider: z.object({ label: z.string().max(80).optional() }),
} satisfies Record<PresenceSectionType, z.ZodType>;

export const presenceSectionStyleSchema = z.object({
  background: z.enum(["default", "surface", "muted", "primary", "dark"]).optional(),
  theme: z.enum(["default", "muted", "brand", "dark"]).optional(),
  width: z.enum(["md", "lg", "xl", "full"]).optional(),
  alignment: z.enum(["left", "center"]).optional(),
  spacing: z.enum(["compact", "normal", "airy"]).optional(),
  radius: z.enum(["none", "sm", "md", "lg"]).optional(),
  mediaTreatment: z.enum(["plain", "rounded", "frame"]).optional(),
  backgroundAssetId: z.uuid().optional(),
});

export function validatePresenceSectionContent(type: PresenceSectionType, content: unknown) {
  return presenceSectionContentSchemas[type].safeParse(content);
}
