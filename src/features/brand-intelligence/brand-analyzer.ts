import type { BrandProfile } from "@/types";
import { buildPalette, luminance, rgbToHex, saturation } from "./colors";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export function sanitizeSvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*("|')(?:https?:|data:text\/html)[\s\S]*?\1/gi, "");
}

async function validateSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const isPng = bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  const isSvg = file.type === "image/svg+xml" && (await file.text()).slice(0, 2048).toLowerCase().includes("<svg");
  if (!(isPng || isJpeg || isWebp || isSvg)) throw new Error("O conteúdo do arquivo não corresponde a uma imagem aceita.");
}

function quantize(data: Uint8ClampedArray) {
  const buckets = new Map<string, { count: number; score: number }>();
  for (let index = 0; index < data.length; index += 16) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const alpha = data[index + 3];
    if (alpha < 32) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const neutralExtreme = max > 244 || min < 12;
    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const hex = rgbToHex(qr, qg, qb);
    const chroma = max === 0 ? 0 : (max - min) / max;
    const weight = (neutralExtreme ? 0.18 : 1) * (0.55 + chroma);
    const current = buckets.get(hex) || { count: 0, score: 0 };
    buckets.set(hex, { count: current.count + 1, score: current.score + weight });
  }
  const selected: string[] = [];
  const distance = (left: string, right: string) => {
    const a = Number.parseInt(left.slice(1), 16);
    const b = Number.parseInt(right.slice(1), 16);
    const ar = (a >> 16) & 255; const ag = (a >> 8) & 255; const ab = a & 255;
    const br = (b >> 16) & 255; const bg = (b >> 8) & 255; const bb = b & 255;
    return Math.hypot(ar - br, ag - bg, ab - bb);
  };
  for (const [hex] of [...buckets.entries()].sort((a, b) => b[1].score - a[1].score)) {
    if (selected.every((color) => distance(color, hex) > 62)) selected.push(hex);
    if (selected.length === 6) break;
  }
  return selected;
}

export async function analyzeBrandFile(file: File): Promise<BrandProfile> {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error("Use PNG, JPG, WebP ou SVG.");
  if (file.size > MAX_LOGO_BYTES) throw new Error("A logo deve ter no máximo 5 MB.");
  await validateSignature(file);

  let logoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a logo."));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/svg+xml") {
    const safe = sanitizeSvg(await file.text());
    logoDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(safe)))}`;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    element.src = logoDataUrl;
  });
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("O navegador não suporta análise de imagem.");
  context.clearRect(0, 0, size, size);
  const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * ratio; const height = image.naturalHeight * ratio;
  context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  const extracted = quantize(context.getImageData(0, 0, size, size).data);
  const colors = extracted.length ? extracted : ["#6D5EF5", "#FF725E", "#19B88B"];
  const baseLuminance = colors.reduce((sum, color) => sum + luminance(color), 0) / colors.length;
  const avgSaturation = colors.reduce((sum, color) => sum + saturation(color), 0) / colors.length;

  return {
    logoDataUrl,
    extractedColors: colors,
    activePalette: buildPalette(colors, "balanced"),
    paletteVariations: [
      { name: "Fiel", palette: buildPalette(colors, "faithful") },
      { name: "Equilibrada", palette: buildPalette(colors, "balanced") },
      { name: "Ousada", palette: buildPalette(colors, "bold") },
    ],
    brandPersonality: [avgSaturation > 0.55 ? "Vibrante" : "Minimalista"],
    analysisMetadata: {
      confidence: Math.min(0.98, 0.62 + colors.length * 0.06),
      orientation: image.naturalWidth > image.naturalHeight * 1.35 ? "horizontal" : image.naturalHeight > image.naturalWidth * 1.35 ? "vertical" : "square",
      luminance: baseLuminance > 0.67 ? "light" : baseLuminance < 0.28 ? "dark" : "mixed",
      colorCount: colors.length,
    },
  };
}
