import { NextResponse } from "next/server";
import sharp from "sharp";
import { buildPalette, rgbToHex } from "@/features/brand-intelligence/colors";
import { sanitizeSvg } from "@/features/brand-intelligence/brand-analyzer";
import { checkRateLimit } from "@/server/services/rate-limit";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  if (!checkRateLimit(`brand:${ip}`, 10, 60_000)) return NextResponse.json({ error: "Muitas análises." }, { status: 429 });
  const data = await request.formData(); const file = data.get("logo");
  if (!(file instanceof File) || !allowed.has(file.type) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Logo inválida." }, { status: 400 });
  let buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "image/svg+xml") buffer = Buffer.from(sanitizeSvg(buffer.toString("utf8")));
  try {
    const image = sharp(buffer, { limitInputPixels: 25_000_000 }).resize(96, 96, { fit: "contain" }).ensureAlpha(); const { data: pixels } = await image.raw().toBuffer({ resolveWithObject: true });
    const buckets = new Map<string, number>();
    for (let index = 0; index < pixels.length; index += 16) { const alpha = pixels[index + 3]; if (alpha < 32) continue; const r = Math.round(pixels[index] / 24) * 24; const g = Math.round(pixels[index + 1] / 24) * 24; const b = Math.round(pixels[index + 2] / 24) * 24; const hex = rgbToHex(r, g, b); const extreme = Math.max(r, g, b) > 244 || Math.min(r, g, b) < 12; buckets.set(hex, (buckets.get(hex) || 0) + (extreme ? .15 : 1)); }
    const colors = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color); const source = colors.length ? colors : ["#6D5EF5"];
    return NextResponse.json({ colors: source, variations: [{ name: "Fiel", palette: buildPalette(source, "faithful") }, { name: "Equilibrada", palette: buildPalette(source, "balanced") }, { name: "Ousada", palette: buildPalette(source, "bold") }], confidence: Math.min(.97, .64 + source.length * .05) });
  } catch { return NextResponse.json({ error: "Não foi possível processar a logo." }, { status: 422 }); }
}
