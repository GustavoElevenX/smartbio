import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.cwd(), ".env.vercel");

function parseExisting(path: string) {
  if (!existsSync(path)) return {} as Record<string, string>;
  const entries: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const raw = match[2].trim();
    try {
      entries[match[1]] = raw.startsWith('"') ? JSON.parse(raw) : raw;
    } catch {
      entries[match[1]] = raw;
    }
  }
  return entries;
}

const existing = parseExisting(outputPath);
const output = new Map<string, string>();
const source = (name: string) => process.env[name]?.trim() || existing[name]?.trim() || "";
const set = (name: string, value?: string) => {
  if (value?.trim()) output.set(name, value.trim());
};
const secret = (name: string) => {
  const current = source(name);
  set(name, current.length >= 32 ? current : randomBytes(48).toString("base64url"));
};

const requiredSource = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
const missing = requiredSource.filter((name) => !source(name));
if (missing.length) {
  console.error(`Preencha no .env local antes de gerar: ${missing.join(", ")}.`);
  process.exit(1);
}

set("NEXT_PUBLIC_APP_NAME", source("NEXT_PUBLIC_APP_NAME") || "SOBE");
for (const name of requiredSource) set(name, source(name));
set("SUPABASE_AUTH_REQUIRE_EMAIL_CONFIRMATION", source("SUPABASE_AUTH_REQUIRE_EMAIL_CONFIRMATION") || "true");
set("ENABLE_LOCAL_DEV_AUTH", "false");
set("NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE", "false");

for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_PUBLIC_BASE_URL"] as const) {
  const configured = source(name);
  if (configured.startsWith("https://")) set(name, configured);
}

const openAiKey = source("OPENAI_API_KEY");
const aiEnabled = Boolean(openAiKey);
set("NEXT_PUBLIC_FEATURE_AI", String(aiEnabled));
set("AI_PROVIDER", "openai");
if (aiEnabled) {
  set("OPENAI_API_KEY", openAiKey);
  set("OPENAI_MODEL", source("OPENAI_MODEL") || "gpt-5.4-mini-2026-03-17");
  set("OPENAI_VISION_MODEL", source("OPENAI_VISION_MODEL") || "gpt-5.4-mini-2026-03-17");
  set("OPENAI_MAX_OUTPUT_TOKENS", source("OPENAI_MAX_OUTPUT_TOKENS") || "8000");
  set("AI_REQUEST_TIMEOUT_MS", source("AI_REQUEST_TIMEOUT_MS") || "60000");
  set("AI_MAX_RETRIES", source("AI_MAX_RETRIES") || "2");
  set("AI_PROMPT_VERSION", source("AI_PROMPT_VERSION") || "final-beta-v1");
}

const upstashUrl = source("UPSTASH_REDIS_REST_URL");
const upstashToken = source("UPSTASH_REDIS_REST_TOKEN");
if (upstashUrl && upstashToken) {
  set("UPSTASH_REDIS_REST_URL", upstashUrl);
  set("UPSTASH_REDIS_REST_TOKEN", upstashToken);
}

const resendKey = source("RESEND_API_KEY");
const emailFrom = source("EMAIL_FROM");
const notificationsEnabled = Boolean(resendKey && emailFrom);
set("NEXT_PUBLIC_FEATURE_NOTIFICATIONS", String(notificationsEnabled));
set("EMAIL_PROVIDER", notificationsEnabled ? "resend" : "console");
if (notificationsEnabled) {
  set("RESEND_API_KEY", resendKey);
  set("EMAIL_FROM", emailFrom);
  set("EMAIL_REPLY_TO", source("EMAIL_REPLY_TO"));
}

const mapsServerKey = source("GOOGLE_MAPS_SERVER_API_KEY");
const mapsBrowserKey = source("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY");
const mapsEnabled = Boolean(mapsServerKey && mapsBrowserKey);
set("NEXT_PUBLIC_FEATURE_GEO_ROUTING", String(mapsEnabled));
set("MAPS_PROVIDER", "google");
if (mapsEnabled) {
  set("GOOGLE_MAPS_SERVER_API_KEY", mapsServerKey);
  set("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", mapsBrowserKey);
}

const stripeVariables = [
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PRODUCT_ID",
] as const;
const stripeConfigured = stripeVariables.every((name) => Boolean(source(name)));
const stripePartiallyConfigured = stripeVariables.some((name) => Boolean(source(name)));
if (stripePartiallyConfigured && !stripeConfigured) {
  const stripeMissing = stripeVariables.filter((name) => !source(name));
  console.error(`Para habilitar billing, preencha no .env local: ${stripeMissing.join(", ")}.`);
  process.exit(1);
}
set("NEXT_PUBLIC_FEATURE_BILLING", String(stripeConfigured));
if (stripeConfigured)
  for (const name of stripeVariables) set(name, source(name));

set("DEFAULT_COUNTRY", source("DEFAULT_COUNTRY") || "BR");
set("DEFAULT_TIMEZONE", source("DEFAULT_TIMEZONE") || "America/Sao_Paulo");
set("SENTRY_DSN", source("SENTRY_DSN"));
set("NEXT_PUBLIC_SENTRY_DSN", source("NEXT_PUBLIC_SENTRY_DSN"));

const featureDefaults: Record<string, string> = {
  NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS: String(aiEnabled),
  NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION: String(aiEnabled),
  NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT: String(aiEnabled),
  NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS: String(aiEnabled),
  NEXT_PUBLIC_FEATURE_AI_OPTIMIZATION: "false",
  NEXT_PUBLIC_FEATURE_PRESENCE_AI: String(aiEnabled),
  NEXT_PUBLIC_FEATURE_QUALIFICATION: "true",
  NEXT_PUBLIC_FEATURE_QUOTES: "true",
  NEXT_PUBLIC_FEATURE_SCHEDULING: "true",
  NEXT_PUBLIC_FEATURE_ROUTING: "true",
  NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: "true",
  NEXT_PUBLIC_FEATURE_RESERVATIONS: "true",
  NEXT_PUBLIC_FEATURE_EXTERNAL_PAYMENTS: "true",
  NEXT_PUBLIC_FEATURE_CALENDAR_SYNC: "false",
  NEXT_PUBLIC_FEATURE_CHAT: "false",
  NEXT_PUBLIC_FEATURE_CUSTOM_DOMAINS: "false",
  NEXT_PUBLIC_FEATURE_MULTI_UNIT: "true",
  NEXT_PUBLIC_FEATURE_CONVERSION_GOALS: "true",
  NEXT_PUBLIC_FEATURE_ENTRY_POINTS: "true",
  NEXT_PUBLIC_FEATURE_OPPORTUNITIES: "true",
  NEXT_PUBLIC_FEATURE_CONVERSION_ANALYTICS: "true",
  NEXT_PUBLIC_FEATURE_PRESENCE: "true",
  NEXT_PUBLIC_FEATURE_PRESENCE_MULTI_PAGE: "true",
  NEXT_PUBLIC_FEATURE_ACTIVATIONS: "true",
  NEXT_PUBLIC_FEATURE_BENEFIT_CLAIMS: "true",
  NEXT_PUBLIC_FEATURE_HUMAN_REDEMPTION: "true",
  NEXT_PUBLIC_FEATURE_CUSTOMER_HISTORY_IMPORT: "true",
};
const aiFeatureNames = new Set([
  "NEXT_PUBLIC_FEATURE_AI_BUSINESS_ANALYSIS",
  "NEXT_PUBLIC_FEATURE_AI_JOURNEY_COMPOSITION",
  "NEXT_PUBLIC_FEATURE_AI_SOURCE_IMPORT",
  "NEXT_PUBLIC_FEATURE_AI_BRAND_ANALYSIS",
  "NEXT_PUBLIC_FEATURE_AI_OPTIMIZATION",
  "NEXT_PUBLIC_FEATURE_PRESENCE_AI",
]);
for (const [name, fallback] of Object.entries(featureDefaults))
  set(
    name,
    !aiEnabled && aiFeatureNames.has(name) ? "false" : source(name) || fallback,
  );

secret("RATE_LIMIT_SECRET");
secret("ENCRYPTION_KEY");
secret("CRON_SECRET");
secret("CUSTOMER_IDENTITY_HASH_SECRET");

const content = [
  "# Gerado para importação em Vercel > Settings > Environment Variables.",
  "# Não versionar este arquivo: ele contém segredos.",
  ...Array.from(output, ([name, value]) => `${name}=${JSON.stringify(value)}`),
  "",
].join("\n");
writeFileSync(outputPath, content, { encoding: "utf8", mode: 0o600 });
console.log(`Arquivo .env.vercel criado com ${output.size} variáveis, sem valores vazios ou NODE_ENV.`);
