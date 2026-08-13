import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import {
  AuthenticationRequiredError,
  EmailNotConfirmedError,
  ProductionConfigurationError,
  WorkspaceAccessDeniedError,
} from "@/server/auth/auth-errors";
import type { PlatformAdminActor } from "./platform-admin-actor";

export async function requirePlatformAdmin(
  required?: "super_admin",
): Promise<PlatformAdminActor> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new ProductionConfigurationError();

  const cookieStore = await cookies();
  const auth = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot always persist refreshed cookies.
        }
      },
    },
  });
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user) throw new AuthenticationRequiredError();
  if (!user.email_confirmed_at) throw new EmailNotConfirmedError();

  const db = createServiceClient();
  if (!db) throw new ProductionConfigurationError();
  const { data, error } = await db
    .from("platform_admins")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data?.is_active || (required && data.role !== required)) {
    throw new WorkspaceAccessDeniedError("Acesso administrativo negado.");
  }
  return { userId: user.id, email: user.email || "", role: data.role };
}
