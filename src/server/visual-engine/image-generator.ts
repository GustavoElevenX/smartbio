import "server-only";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { planVisualImage, type VisualImageQuality } from "@/features/visual-engine/image-plan";
import type { DesignKit, VisualSpec } from "@/features/visual-engine/schema";
import { parseCloudflareImage } from "@/server/content-studio/studio";

function imageError(error: unknown) {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return new Error("Limite do gerador de imagens alcançado. Tente mais tarde ou use uma foto da biblioteca.");
    if (error.status === 401 || error.status === 403) return new Error("A chave OpenAI não tem acesso ao modelo de imagens configurado.");
    return new Error(`Não foi possível gerar a imagem premium (OpenAI ${error.status || "indisponível"}).`);
  }
  return error;
}

export async function generatePremiumVisualImage(spec: VisualSpec, kit: DesignKit, reference?: Buffer) {
  if (!process.env.OPENAI_API_KEY) throw new Error("Configure OPENAI_API_KEY para gerar imagens premium.");
  const plan = planVisualImage(spec, kit);
  const model = process.env.VISUAL_IMAGE_MODEL || "gpt-image-2.5-sunburst";
  const quality = (process.env.VISUAL_IMAGE_QUALITY || "xhigh") as VisualImageQuality;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 180_000, maxRetries: 1 });
  try {
    // The installed SDK predates the 2.5 quality enum; it forwards this value unchanged.
    const params = { model, prompt: plan.prompt, size: plan.size, quality: quality as "high", output_format: "png" as const, background: "opaque" as const, n: 1 };
    const result = reference
      ? await client.images.edit({ ...params, image: await toFile(await sharp(reference, { limitInputPixels: 40_000_000 }).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).png().toBuffer(), "product-reference.png", { type: "image/png" }), input_fidelity: "high" })
      : await client.images.generate(params);
    const base64 = result.data?.[0]?.b64_json;
    if (!base64) throw new Error("A geração terminou sem uma imagem utilizável.");
    const source = Buffer.from(base64, "base64");
    const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 512) throw new Error("A imagem gerada tem resolução insuficiente. Gere novamente.");
    return sharp(source).rotate().png({ compressionLevel: 9 }).toBuffer();
  } catch (error) {
    throw imageError(error);
  }
}

export async function generateBasicVisualImage(spec: VisualSpec, kit: DesignKit) {
  if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Configure as credenciais da Cloudflare para gerar imagens.");
  const plan = planVisualImage(spec, kit);
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: plan.prompt, steps: 4 }), signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "A cota da Cloudflare acabou. Tente novamente amanhã." : `Cloudflare retornou ${response.status}.`);
  const source = parseCloudflareImage(await response.json());
  return sharp(source, { limitInputPixels: 40_000_000 }).rotate().png().toBuffer();
}
