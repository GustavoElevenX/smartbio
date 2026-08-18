import "server-only";

import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { brandIdentitySchema, type BrandAIResult, type BrandIdentity } from "@/features/ai-setup/ai-setup.schema";
import { buildPalette, luminance, rgbToHex, saturation } from "@/features/brand-intelligence/colors";
import { sanitizeSvg } from "@/features/brand-intelligence/brand-analyzer";
import { createServiceClient } from "@/lib/supabase/server";
import { getAIProvider, isAIConfigured } from "@/server/ai/ai-client";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { sourceRepository } from "@/server/business-sources/source-repository";
import { requireEntitlement } from "@/server/entitlements/require-entitlement";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

function cleanName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 180) || "logo";
}

function colorDistance(left: string, right: string) {
  const a = Number.parseInt(left.slice(1), 16);
  const b = Number.parseInt(right.slice(1), 16);
  return Math.hypot(
    ((a >> 16) & 255) - ((b >> 16) & 255),
    ((a >> 8) & 255) - ((b >> 8) & 255),
    (a & 255) - (b & 255),
  );
}

function extractColors(pixels: Buffer) {
  const buckets = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = pixels[index + 3];
    if (alpha < 32) continue;
    const red = Math.round(pixels[index] / 24) * 24;
    const green = Math.round(pixels[index + 1] / 24) * 24;
    const blue = Math.round(pixels[index + 2] / 24) * 24;
    const hex = rgbToHex(red, green, blue);
    const extreme = Math.max(red, green, blue) > 244 || Math.min(red, green, blue) < 12;
    const chroma = Math.max(red, green, blue) === 0
      ? 0
      : (Math.max(red, green, blue) - Math.min(red, green, blue)) / Math.max(red, green, blue);
    buckets.set(hex, (buckets.get(hex) || 0) + (extreme ? 0.16 : 1) * (0.55 + chroma));
  }
  const colors: string[] = [];
  for (const [hex] of [...buckets.entries()].sort((left, right) => right[1] - left[1])) {
    if (colors.every((color) => colorDistance(color, hex) > 62)) colors.push(hex);
    if (colors.length === 6) break;
  }
  return colors;
}

export async function analyzeAndStoreBrandLogo(
  actor: AuthenticatedActor,
  file: File,
  input: { businessName?: string; businessDescription?: string },
): Promise<BrandIdentity> {
  if (actor.persistence === "memory") throw new Error("Configure o Supabase para salvar a identidade da marca.");
  if (!allowedTypes.has(file.type) || !file.size || file.size > MAX_LOGO_BYTES) {
    throw new Error("Use uma logo PNG, JPG, WebP ou SVG de até 5 MB.");
  }
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  await requireEntitlement({ database, workspaceId: actor.workspaceId, feature: "ai_business_analysis" });

  let originalBuffer = Buffer.from(await file.arrayBuffer());
  let storedMimeType = file.type;
  let storedName = cleanName(file.name);
  if (file.type === "image/svg+xml") {
    originalBuffer = await sharp(Buffer.from(sanitizeSvg(originalBuffer.toString("utf8")))).png().toBuffer();
    storedMimeType = "image/png";
    storedName = `${storedName.replace(/\.svg$/i, "")}.png`;
  }

  const image = sharp(originalBuffer, { limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width > 10_000 || metadata.height > 10_000) {
    throw new Error("As dimensões da logo não são válidas.");
  }
  const pixels = await image.clone().resize(128, 128, { fit: "contain" }).ensureAlpha().raw().toBuffer();
  const extractedColors = extractColors(pixels);
  const colors = extractedColors.length ? extractedColors : ["#0054FC", "#0186FC", "#01D2DF", "#02E5CD"];
  const averageLuminance = colors.reduce((total, color) => total + luminance(color), 0) / colors.length;
  const averageSaturation = colors.reduce((total, color) => total + saturation(color), 0) / colors.length;

  const fallback = {
    personality: [averageSaturation > 0.55 ? "Vibrante" : "Minimalista", "Confiante"],
    visualDirection: "Identidade equilibrada, clara e orientada à conversão.",
    density: "balanced" as const,
    borderStyle: "Arredondado e preciso",
    contrast: "balanced" as const,
    toneOfVoice: "Direto e confiante",
    typographySuggestion: "Manrope para títulos e Inter para textos",
    imageUsage: "Priorize a logo com respiro e fundos de alto contraste.",
  };
  let ai: BrandAIResult = fallback;
  let aiEnhanced = false;
  if (isAIConfigured() && getAIProvider().analyzeBrand) {
    try {
      ai = await getAIProvider().analyzeBrand!({
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        businessName: input.businessName?.trim() || "Negócio sem nome definido",
        businessDescription: input.businessDescription?.trim() || "Identidade visual em configuração.",
        extractedColors: colors,
        fileData: originalBuffer.toString("base64"),
        mimeType: storedMimeType,
      });
      aiEnhanced = true;
    } catch {
      ai = fallback;
    }
  }

  const sourceId = randomUUID();
  const path = `${actor.workspaceId}/${sourceId}/${storedName}`;
  const source = await sourceRepository.create(actor, {
    id: sourceId,
    type: "image",
    name: storedName,
    storagePath: path,
    mimeType: storedMimeType,
    fileSize: originalBuffer.byteLength,
    checksum: createHash("sha256").update(originalBuffer).digest("hex"),
  });
  const { error: uploadError } = await database.storage.from("business-sources").upload(path, originalBuffer, {
    contentType: storedMimeType,
    upsert: false,
  });
  if (uploadError) {
    await sourceRepository.update(actor, sourceId, { status: "failed", processing_error: "Falha ao salvar a logo privada." });
    throw new Error("Não foi possível armazenar a logo.");
  }

  const identity = brandIdentitySchema.parse({
    sourceId,
    fileName: storedName,
    extractedColors: colors,
    activePalette: buildPalette(colors, "balanced"),
    paletteVariations: [
      { name: "Fiel", palette: buildPalette(colors, "faithful") },
      { name: "Equilibrada", palette: buildPalette(colors, "balanced") },
      { name: "Ousada", palette: buildPalette(colors, "bold") },
    ],
    brandPersonality: ai.personality,
    visualDirection: ai.visualDirection,
    density: ai.density,
    contrast: ai.contrast,
    typographySuggestion: ai.typographySuggestion,
    imageUsage: ai.imageUsage,
    analysisMetadata: {
      confidence: Math.min(0.98, 0.64 + colors.length * 0.05 + (aiEnhanced ? 0.05 : 0)),
      orientation: metadata.width > metadata.height * 1.35 ? "horizontal" : metadata.height > metadata.width * 1.35 ? "vertical" : "square",
      luminance: averageLuminance > 0.67 ? "light" : averageLuminance < 0.28 ? "dark" : "mixed",
      colorCount: colors.length,
      aiEnhanced,
    },
  });
  await sourceRepository.update(actor, source.id, {
    status: "processed",
    extracted_data: { kind: "brand_logo", identity },
    processing_error: null,
  });
  return identity;
}
