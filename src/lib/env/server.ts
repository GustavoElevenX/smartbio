import "server-only";
import { z } from "zod";

const optionalText = z.string().trim().transform((value) => value || undefined).optional();

export const serverEnvSchema = z.object({
  ENABLE_LOCAL_DEV_AUTH: z.enum(["true", "false"]).default("false"),
  AI_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: optionalText,
  OPENAI_MODEL: optionalText.default("gpt-5.4-mini-2026-03-17"),
  OPENAI_VISION_MODEL: optionalText.default("gpt-5.4-mini-2026-03-17"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(100_000).default(8000),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).default(60_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_PROMPT_VERSION: z.string().trim().min(1).default("2026-08-05-v1"),
  SUPABASE_SERVICE_ROLE_KEY: optionalText,
  UPSTASH_REDIS_REST_URL: optionalText,
  UPSTASH_REDIS_REST_TOKEN: optionalText,
  EMAIL_PROVIDER: z.enum(["resend", "console"]).default("resend"),
  RESEND_API_KEY: optionalText,
  EMAIL_FROM: optionalText,
  EMAIL_REPLY_TO: optionalText,
  MAPS_PROVIDER: z.enum(["google"]).default("google"),
  GOOGLE_MAPS_SERVER_API_KEY: optionalText,
  DEFAULT_COUNTRY: z.string().trim().length(2).default("BR"),
  DEFAULT_TIMEZONE: z.string().trim().min(1).default("America/Sao_Paulo"),
  RATE_LIMIT_SECRET: optionalText,
  CUSTOMER_IDENTITY_HASH_SECRET: optionalText,
  ENCRYPTION_KEY: optionalText,
  CRON_SECRET: optionalText,
  SENTRY_DSN: optionalText,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ServerFeature = "ai" | "email" | "maps" | "supabase" | "rateLimit" | "customerIdentity";

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(source);
}

export function validateServerFeature(feature: ServerFeature, source: NodeJS.ProcessEnv = process.env) {
  const env = readServerEnv(source);
  const missing: string[] = [];
  if (feature === "ai") {
    if (!env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
    if (source.NODE_ENV === "production") {
      if (!env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
      if (!env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
    }
  }
  if (feature === "email" && env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
    if (!env.EMAIL_FROM) missing.push("EMAIL_FROM");
  }
  if (feature === "maps" && !env.GOOGLE_MAPS_SERVER_API_KEY) missing.push("GOOGLE_MAPS_SERVER_API_KEY");
  if (feature === "supabase" && !env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (feature === "rateLimit") {
    if (!env.UPSTASH_REDIS_REST_URL) missing.push("UPSTASH_REDIS_REST_URL");
    if (!env.UPSTASH_REDIS_REST_TOKEN) missing.push("UPSTASH_REDIS_REST_TOKEN");
  }
  if (feature === "customerIdentity" && source.NODE_ENV === "production" && !env.CUSTOMER_IDENTITY_HASH_SECRET) missing.push("CUSTOMER_IDENTITY_HASH_SECRET");
  if (missing.length) throw new Error(`Configuração ausente para ${feature}: ${missing.join(", ")}.`);
  return env;
}
