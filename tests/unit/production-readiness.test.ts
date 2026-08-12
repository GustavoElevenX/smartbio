import { describe, expect, it } from "vitest";
import { productionReadinessIssues } from "@/lib/env/production-readiness";

const productionEnv = {
  NODE_ENV: "production",
  ENABLE_LOCAL_DEV_AUTH: "false",
  NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE: "false",
  NEXT_PUBLIC_APP_URL: "https://virou.example",
  NEXT_PUBLIC_PUBLIC_BASE_URL: "https://virou.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  NEXT_PUBLIC_FEATURE_AI: "true",
  OPENAI_API_KEY: "configured",
  OPENAI_MODEL: "gpt-5.4-mini-2026-03-17",
  OPENAI_VISION_MODEL: "gpt-5.4-mini-2026-03-17",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "configured",
  RATE_LIMIT_SECRET: "a".repeat(32),
  ENCRYPTION_KEY: "b".repeat(32),
  CRON_SECRET: "c".repeat(32),
  CUSTOMER_IDENTITY_HASH_SECRET: "d".repeat(32),
} satisfies NodeJS.ProcessEnv;

describe("readiness do ambiente de produção", () => {
  it("aceita uma configuração segura mínima", () => {
    expect(productionReadinessIssues(productionEnv)).toEqual([]);
  });

  it("rejeita modo local, HTTP e segredos fracos ou repetidos", () => {
    const issues = productionReadinessIssues({
      ...productionEnv,
      ENABLE_LOCAL_DEV_AUTH: "true",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      RATE_LIMIT_SECRET: "same",
      CRON_SECRET: "same",
    });
    expect(issues.map((issue) => issue.variable)).toEqual(expect.arrayContaining([
      "ENABLE_LOCAL_DEV_AUTH",
      "NEXT_PUBLIC_APP_URL",
      "RATE_LIMIT_SECRET",
      "CRON_SECRET",
    ]));
  });

  it("exige provedores das features habilitadas", () => {
    const issues = productionReadinessIssues({
      ...productionEnv,
      NEXT_PUBLIC_FEATURE_NOTIFICATIONS: "true",
      EMAIL_PROVIDER: "resend",
      NEXT_PUBLIC_FEATURE_GEO_ROUTING: "true",
    });
    expect(issues.map((issue) => issue.variable)).toEqual(expect.arrayContaining([
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "GOOGLE_MAPS_SERVER_API_KEY",
      "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY",
    ]));
  });
});
