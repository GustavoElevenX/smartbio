import "server-only";

import type { RateLimitProvider, RateLimitResult, RateLimitRule } from "@/server/rate-limit/rate-limit-provider";

const buckets = new Map<string, { count: number; resetAt: number }>();

export class MemoryRateLimitProvider implements RateLimitProvider {
  async consume(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + rule.windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { allowed: true, limit: rule.limit, remaining: Math.max(0, rule.limit - 1), resetAt };
    }
    if (current.count >= rule.limit) return { allowed: false, limit: rule.limit, remaining: 0, resetAt: current.resetAt };
    current.count += 1;
    return { allowed: true, limit: rule.limit, remaining: Math.max(0, rule.limit - current.count), resetAt: current.resetAt };
  }
}
