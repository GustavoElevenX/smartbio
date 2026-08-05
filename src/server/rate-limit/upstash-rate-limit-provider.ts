import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimitProvider, RateLimitResult, RateLimitRule } from "@/server/rate-limit/rate-limit-provider";

export class UpstashRateLimitProvider implements RateLimitProvider {
  private readonly redis: Redis;
  constructor(url: string, token: string) { this.redis = new Redis({ url, token }); }

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const limiter = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowMs} ms`),
      prefix: "smartbio:rate-limit",
      analytics: true,
    });
    const result = await limiter.limit(key);
    return { allowed: result.success, limit: result.limit, remaining: result.remaining, resetAt: result.reset };
  }
}
