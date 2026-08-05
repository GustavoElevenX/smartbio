import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("SmartBio"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: z.string().trim().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().trim().optional(),
  NEXT_PUBLIC_FEATURE_AI: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_QUALIFICATION: booleanString.default(true),
  NEXT_PUBLIC_FEATURE_QUOTES: booleanString.default(true),
  NEXT_PUBLIC_FEATURE_SCHEDULING: booleanString.default(true),
  NEXT_PUBLIC_FEATURE_ROUTING: booleanString.default(true),
  NEXT_PUBLIC_FEATURE_GEO_ROUTING: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_RESERVATIONS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_NOTIFICATIONS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_CALENDAR_SYNC: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_CHAT: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_BILLING: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS: booleanString.default(false),
  NEXT_PUBLIC_FEATURE_MULTI_UNIT: booleanString.default(true),
});

function emptyToUndefined(value: string | undefined) {
  return value?.trim() ? value : undefined;
}

export function readClientEnv() {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY),
    NEXT_PUBLIC_SENTRY_DSN: emptyToUndefined(process.env.NEXT_PUBLIC_SENTRY_DSN),
    NEXT_PUBLIC_FEATURE_AI: process.env.NEXT_PUBLIC_FEATURE_AI,
    NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS: process.env.NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS,
    NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION: process.env.NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION,
    NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT: process.env.NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT,
    NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS: process.env.NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS,
    NEXT_PUBLIC_FEATURE_QUALIFICATION: process.env.NEXT_PUBLIC_FEATURE_QUALIFICATION,
    NEXT_PUBLIC_FEATURE_QUOTES: process.env.NEXT_PUBLIC_FEATURE_QUOTES,
    NEXT_PUBLIC_FEATURE_SCHEDULING: process.env.NEXT_PUBLIC_FEATURE_SCHEDULING,
    NEXT_PUBLIC_FEATURE_ROUTING: process.env.NEXT_PUBLIC_FEATURE_ROUTING,
    NEXT_PUBLIC_FEATURE_GEO_ROUTING: process.env.NEXT_PUBLIC_FEATURE_GEO_ROUTING,
    NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: process.env.NEXT_PUBLIC_FEATURE_CATALOG_ORDERS,
    NEXT_PUBLIC_FEATURE_RESERVATIONS: process.env.NEXT_PUBLIC_FEATURE_RESERVATIONS,
    NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS: process.env.NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS,
    NEXT_PUBLIC_FEATURE_NOTIFICATIONS: process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS,
    NEXT_PUBLIC_FEATURE_CALENDAR_SYNC: process.env.NEXT_PUBLIC_FEATURE_CALENDAR_SYNC,
    NEXT_PUBLIC_FEATURE_CHAT: process.env.NEXT_PUBLIC_FEATURE_CHAT,
    NEXT_PUBLIC_FEATURE_BILLING: process.env.NEXT_PUBLIC_FEATURE_BILLING,
    NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS: process.env.NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS,
    NEXT_PUBLIC_FEATURE_MULTI_UNIT: process.env.NEXT_PUBLIC_FEATURE_MULTI_UNIT,
  });
}

export const clientEnv = readClientEnv();
