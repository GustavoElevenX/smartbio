import { createClient } from "@supabase/supabase-js";
import { ProductionConfigurationError } from "@/server/auth/auth-errors";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    if (process.env.NODE_ENV === "production") throw new ProductionConfigurationError("O Supabase server-side não está configurado.");
    return null;
  }
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
