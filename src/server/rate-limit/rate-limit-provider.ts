import "server-only";

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitProvider {
  consume(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}
