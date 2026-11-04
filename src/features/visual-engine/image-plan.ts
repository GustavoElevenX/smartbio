import { visualSizes, type DesignKit, type VisualSpec } from "./schema";

export type VisualImageProvider = "openai" | "cloudflare";
export type VisualImageQuality = "high" | "xhigh" | "max";

export function chooseVisualImageProvider(config: { preferred?: string; openaiKey?: string; cloudflareAccount?: string; cloudflareToken?: string }): VisualImageProvider {
  const openaiReady = Boolean(config.openaiKey);
  const cloudflareReady = Boolean(config.cloudflareAccount && config.cloudflareToken);
  if (config.preferred === "openai") {
    if (!openaiReady) throw new Error("Configure OPENAI_API_KEY para gerar imagens premium.");
    return "openai";
  }
  if (config.preferred === "cloudflare") {
    if (!cloudflareReady) throw new Error("Configure CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN para gerar imagens.");
    return "cloudflare";
  }
  if (openaiReady) return "openai";
  if (cloudflareReady) return "cloudflare";
  throw new Error("Configure OPENAI_API_KEY para geração premium ou as credenciais da Cloudflare para geração básica.");
}

export function planVisualImage(spec: VisualSpec, kit: DesignKit) {
  const canvas = visualSizes[spec.target];
  const zone = spec.direction?.imageZone || "full";
  const side = spec.direction?.imageScale === "detail" ? .37 : spec.direction?.imageScale === "dominant" ? .51 : .47;
  const width = zone === "left" || zone === "right" ? canvas.width * side : zone === "center" ? canvas.width * .74 : canvas.width;
  const height = zone === "center" ? canvas.height * .59 : canvas.height;
  const scale = 1536 / Math.max(width, height);
  let outputWidth = Math.max(512, Math.round(width * scale / 16) * 16);
  let outputHeight = Math.max(512, Math.round(height * scale / 16) * 16);
  if (outputWidth / outputHeight < 1 / 3) outputWidth = Math.ceil(outputHeight / 48) * 16;
  if (outputWidth / outputHeight > 3) outputHeight = Math.ceil(outputWidth / 48) * 16;
  const subject = spec.subject || spec.direction?.protagonist || kit.name;
  const position = zone === "right" ? "Place the main subject toward the center of this narrow image zone, with generous padding on all sides." : zone === "left" ? "Place the main subject toward the center of this narrow image zone, with generous padding on all sides." : zone === "center" ? "Show the entire subject within the frame; leave breathing room around every edge." : `Reserve a calm, naturally readable ${spec.direction?.textZone || "left"} area for the editable headline, while the subject stays prominent and fully visible.`;
  const prompt = [
    spec.imagePrompt,
    `Produce a finished premium advertising photograph or visual plate for a ${canvas.width} x ${canvas.height} campaign composition. This generated image occupies the ${zone} image zone; aspect ratio ${outputWidth}:${outputHeight}. ${position}`,
    `The advertised subject is exactly: ${subject}. Depict the commercial product format and volume only when explicitly stated. If packaging is shown, its shape and physical scale must visibly match the stated format. Do not invent product brands, features, certification marks, prices, claims, or package copy.`,
    `Direction: ${spec.direction?.creativeConcept || spec.layout}; ${spec.direction?.composition || "strong, intentional composition"}. Lighting and image treatment: ${spec.direction?.photography || kit.photoStyle}. Restrained palette cues from ${kit.primary}, ${kit.secondary}, ${kit.accent}.`,
    "Photorealistic material detail where the direction calls for photography. Intentional light, natural shadows, clean geometry, accurate anatomy, no plastic-looking surfaces, no stock-photo styling, no collage seams, no accidental empty regions. Keep the complete subject away from crop edges.",
    "This is an image layer only. The application adds all headlines, offers, calls to action and the real brand mark later. No generated headline, typography, watermark, signage, decorative letters or fake logo. If a supplied reference contains actual product packaging, preserve its real package design and existing markings faithfully.",
  ].join(" ").slice(0, 6000);
  return { prompt, size: `${outputWidth}x${outputHeight}`, width: outputWidth, height: outputHeight };
}
