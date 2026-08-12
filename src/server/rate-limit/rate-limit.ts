import "server-only";

import { createHash } from "node:crypto";
import { ProductionConfigurationError } from "@/server/auth/auth-errors";
import { MemoryRateLimitProvider } from "@/server/rate-limit/memory-rate-limit-provider";
import type { RateLimitResult, RateLimitRule } from "@/server/rate-limit/rate-limit-provider";
import { UpstashRateLimitProvider } from "@/server/rate-limit/upstash-rate-limit-provider";

export const rateLimitRules = {
  ai: { limit: 12, windowMs: 60_000 },
  aiGeneration: { limit: 6, windowMs: 60_000 },
  upload: { limit: 12, windowMs: 60_000 },
  publicWrite: { limit: 10, windowMs: 60_000 },
  publicRead: { limit: 60, windowMs: 60_000 },
  aiSetupStart: { limit: 5, windowMs: 60_000 },
  aiAnalyze: { limit: 10, windowMs: 10 * 60_000 },
  aiGenerate: { limit: 5, windowMs: 10 * 60_000 },
  aiRegenerate: { limit: 10, windowMs: 10 * 60_000 },
  aiCopy: { limit: 30, windowMs: 10 * 60_000 },
  sourceUpload: { limit: 20, windowMs: 60 * 60_000 },
  sourceProcess: { limit: 20, windowMs: 60 * 60_000 },
  publicRouteResolve: { limit: 60, windowMs: 60_000 },
  publicFormSubmit: { limit: 20, windowMs: 60_000 },
  publicAttachmentUpload: { limit: 10, windowMs: 10 * 60_000 },
  publicAnalytics: { limit: 120, windowMs: 60_000 },
  activationClaim: { limit: 10, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitRule>;

function provider() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return new UpstashRateLimitProvider(url, token);
  if (process.env.NODE_ENV === "production") throw new ProductionConfigurationError("O rate limit distribuído não está configurado.");
  return new MemoryRateLimitProvider();
}

function privateIdentifier(value: string) {
  const secret = process.env.RATE_LIMIT_SECRET || "smartbio-development";
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export async function consumeRateLimit(scope: string, identifier: string, rule: RateLimitRule, options: { private?: boolean; failClosed?: boolean } = {}) {
  try {
    return await provider().consume(`${scope}:${options.private === false ? identifier : privateIdentifier(identifier)}`, rule);
  } catch (error) {
    if (options.failClosed !== false) throw error;
    return { allowed: true, limit: rule.limit, remaining: rule.limit, resetAt: Date.now() + rule.windowMs } satisfies RateLimitResult;
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function applyRateLimitHeaders<T extends Response>(response: T, result: RateLimitResult) {
  for (const [name, value] of Object.entries(rateLimitHeaders(result))) response.headers.set(name, value);
  return response;
}
