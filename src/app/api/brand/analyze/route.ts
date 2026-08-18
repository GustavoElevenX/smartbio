import { NextResponse } from "next/server";
import sharp from "sharp";
import { buildPalette, rgbToHex } from "@/features/brand-intelligence/colors";
import { sanitizeSvg } from "@/features/brand-intelligence/brand-analyzer";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";

const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export const POST = withAuthenticatedActor(async (request, _context, actor) => {
  const rate = await consumeRateLimit("brand-analyze", actor.userId, rateLimitRules.ai, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(NextResponse.json({ ok: false, error: { code: "rate_limited", message: "Muitas análises." } }, { status: 429 }), rate);
  const data = await request.formData();
  const file = data.get("logo");
  if (!(file instanceof File) || !allowed.has(file.type) || file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, error: { code: "invalid_file", message: "Logo inválida." } }, { status: 400 });
  let buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "image/svg+xml") buffer = Buffer.from(sanitizeSvg(buffer.toString("utf8")));
  try {
    const image = sharp(buffer, { limitInputPixels: 25_000_000 }).resize(96, 96, { fit: "contain" }).ensureAlpha();
    const { data: pixels } = await image.raw().toBuffer({ resolveWithObject: true });
    const buckets = new Map<string, number>();
    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3];
      if (alpha < 32) continue;
      const red = Math.round(pixels[index] / 24) * 24;
      const green = Math.round(pixels[index + 1] / 24) * 24;
      const blue = Math.round(pixels[index + 2] / 24) * 24;
      const hex = rgbToHex(red, green, blue);
      const extreme = Math.max(red, green, blue) > 244 || Math.min(red, green, blue) < 12;
      buckets.set(hex, (buckets.get(hex) || 0) + (extreme ? 0.15 : 1));
    }
    const colors = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color);
    const source = colors.length ? colors : ["#0054fc"];
    return applyRateLimitHeaders(NextResponse.json({ colors: source, variations: [{ name: "Fiel", palette: buildPalette(source, "faithful") }, { name: "Equilibrada", palette: buildPalette(source, "balanced") }, { name: "Ousada", palette: buildPalette(source, "bold") }], confidence: Math.min(0.97, 0.64 + source.length * 0.05) }), rate);
  } catch {
    return NextResponse.json({ ok: false, error: { code: "processing_failed", message: "Não foi possível processar a logo." } }, { status: 422 });
  }
});
