import "server-only";

import { readServerEnv } from "@/lib/env/server";

export function readBillingConfig(source: NodeJS.ProcessEnv = process.env) {
  const env = readServerEnv(source);
  const enabled = source.NEXT_PUBLIC_FEATURE_BILLING === "true";
  const missing = [
    ["STRIPE_API_KEY", env.STRIPE_API_KEY],
    ["STRIPE_WEBHOOK_SECRET", env.STRIPE_WEBHOOK_SECRET],
    ["STRIPE_PRO_PRICE_ID", env.STRIPE_PRO_PRICE_ID],
    ["STRIPE_PRO_PRODUCT_ID", env.STRIPE_PRO_PRODUCT_ID],
    ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY],
  ].filter(([, value]) => !value).map(([name]) => name);
  return {
    enabled,
    configured: enabled && missing.length === 0,
    missing,
    apiKey: env.STRIPE_API_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceId: env.STRIPE_PRO_PRICE_ID,
    productId: env.STRIPE_PRO_PRODUCT_ID,
  };
}
