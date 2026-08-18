import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { apiError } from "@/server/http/api-response";
import {
  PLATFORM_PUBLIC_EVENT_NAMES,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE,
  PLATFORM_VISITOR_COOKIE,
  PLATFORM_VISITOR_MAX_AGE,
  persistPublicPlatformEvent,
  trackingCookieOptions,
} from "@/server/platform-acquisition/platform-acquisition";
import { applyRateLimitHeaders, consumeRateLimit, rateLimitRules } from "@/server/rate-limit/rate-limit";
import { publicRequestIp } from "@/server/rate-limit/public-identifier";

const short = z.string().trim().max(500).optional();
const metadataValue = z.union([z.string().max(500), z.number(), z.boolean()]);
const schema = z.object({
  eventName: z.enum(PLATFORM_PUBLIC_EVENT_NAMES),
  path: z.string().trim().max(500).regex(/^\//).optional(),
  elementKey: z.string().trim().max(120).regex(/^[a-z0-9_.-]+$/i).optional(),
  idempotencyKey: z.string().trim().max(180).optional(),
  metadata: z.record(z.string().max(80), metadataValue).refine((value) => Object.keys(value).length <= 20).optional(),
  utm: z.object({ source: short, medium: short, campaign: short, content: short, term: short }).optional(),
  referrer: z.url().max(1000).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const rate = await consumeRateLimit("platform-track", publicRequestIp(request), rateLimitRules.platformTracking, { failClosed: true });
  if (!rate.allowed) return applyRateLimitHeaders(apiError("Muitos eventos em sequência.", 429, "rate_limited"), rate);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return applyRateLimitHeaders(apiError("Evento de aquisição inválido.", 400, "validation_error"), rate);
  const database = createServiceClient();
  if (!database) return applyRateLimitHeaders(apiError("Tracking indisponível.", 503, "tracking_unavailable"), rate);
  try {
    const result = await persistPublicPlatformEvent(database, parsed.data, {
      visitorCookie: request.cookies.get(PLATFORM_VISITOR_COOKIE)?.value,
      sessionCookie: request.cookies.get(PLATFORM_SESSION_COOKIE)?.value,
      userAgent: request.headers.get("user-agent") || "",
    });
    const response = NextResponse.json({ ok: true, data: { accepted: true } }, { status: 202 });
    response.cookies.set(PLATFORM_VISITOR_COOKIE, result.visitorCookie, trackingCookieOptions(PLATFORM_VISITOR_MAX_AGE));
    response.cookies.set(PLATFORM_SESSION_COOKIE, result.sessionCookie, trackingCookieOptions(PLATFORM_SESSION_MAX_AGE));
    return applyRateLimitHeaders(response, rate);
  } catch {
    return applyRateLimitHeaders(apiError("Não foi possível registrar o evento.", 503, "tracking_failed"), rate);
  }
}
