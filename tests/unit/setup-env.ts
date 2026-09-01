import { afterAll, afterEach, beforeEach, vi } from "vitest";

const unitTestEnv = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_PUBLIC_BASE_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_NAME: "Sobe",
  ENABLE_LOCAL_DEV_AUTH: "false",
  NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE: "true",
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
  SUPABASE_AUTH_REQUIRE_EMAIL_CONFIRMATION: "false",
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
  OPENAI_API_KEY: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
  EMAIL_REPLY_TO: undefined,
  EMAIL_PROVIDER: "console",
  GOOGLE_MAPS_SERVER_API_KEY: undefined,
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: undefined,
  SENTRY_DSN: undefined,
  NEXT_PUBLIC_SENTRY_DSN: undefined,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined,
  STRIPE_API_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  STRIPE_PRO_PRICE_ID: undefined,
  STRIPE_PRO_PRODUCT_ID: undefined,
  RATE_LIMIT_SECRET: undefined,
  ENCRYPTION_KEY: undefined,
  CRON_SECRET: undefined,
  CUSTOMER_IDENTITY_HASH_SECRET: undefined,
  PLATFORM_TRACKING_SECRET: undefined,
  E2E_DISABLE_RATE_LIMITS: undefined,
  ACTIVATION_GATE_FAKE_AI: undefined,
  NEXT_PUBLIC_FEATURE_AI: "false",
  NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS: "false",
  NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION: "false",
  NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT: "false",
  NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS: "false",
  NEXT_PUBLIC_FEATURE_QUALIFICATION: "true",
  NEXT_PUBLIC_FEATURE_QUOTES: "true",
  NEXT_PUBLIC_FEATURE_SCHEDULING: "true",
  NEXT_PUBLIC_FEATURE_ROUTING: "true",
  NEXT_PUBLIC_FEATURE_GEO_ROUTING: "false",
  NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: "false",
  NEXT_PUBLIC_FEATURE_RESERVATIONS: "false",
  NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS: "false",
  NEXT_PUBLIC_FEATURE_NOTIFICATIONS: "false",
  NEXT_PUBLIC_FEATURE_CALENDAR_SYNC: "false",
  NEXT_PUBLIC_FEATURE_CHAT: "false",
  NEXT_PUBLIC_FEATURE_BILLING: "false",
  NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS: "false",
  NEXT_PUBLIC_FEATURE_MULTI_UNIT: "true",
  NEXT_PUBLIC_FEATURE_CONVERSION_GOALS: "true",
  NEXT_PUBLIC_FEATURE_ENTRY_POINTS: "true",
  NEXT_PUBLIC_FEATURE_OPPORTUNITIES: "true",
  NEXT_PUBLIC_FEATURE_CONVERSION_ANALYTICS: "true",
  NEXT_PUBLIC_FEATURE_AI_OPTIMIZATION: "false",
  NEXT_PUBLIC_FEATURE_PRESENCE: "true",
  NEXT_PUBLIC_FEATURE_PRESENCE_AI: "false",
  NEXT_PUBLIC_FEATURE_PRESENCE_MULTI_PAGE: "true",
  NEXT_PUBLIC_FEATURE_ACTIVATIONS: "true",
  NEXT_PUBLIC_FEATURE_BENEFIT_CLAIMS: "true",
  NEXT_PUBLIC_FEATURE_HUMAN_REDEMPTION: "true",
  NEXT_PUBLIC_FEATURE_CUSTOMER_HISTORY_IMPORT: "true",
} as const;

function applyUnitTestEnv() {
  for (const [name, value] of Object.entries(unitTestEnv)) vi.stubEnv(name, value);
}

// Setup files execute before each test module, so import-time env readers see a
// controlled unit-test environment instead of the Vercel worker environment.
applyUnitTestEnv();
beforeEach(applyUnitTestEnv);
afterEach(() => vi.unstubAllEnvs());
afterAll(() => vi.unstubAllEnvs());
