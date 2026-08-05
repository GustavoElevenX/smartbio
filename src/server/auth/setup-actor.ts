import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canUseLocalAuth } from "@/lib/runtime-mode";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/server/auth/workspace-bootstrap";
import {
  AuthenticationRequiredError,
  EmailNotConfirmedError,
  ProductionConfigurationError,
  WorkspaceAccessDeniedError,
  WorkspaceRequiredError,
} from "@/server/auth/auth-errors";

export interface AuthenticatedActor {
  userId: string;
  email: string;
  workspaceId: string;
  role: "owner" | "member";
  persistence: "database" | "memory";
}

export type AISetupActor = AuthenticatedActor;

export interface ActorOptions {
  workspaceId?: string;
  requireConfirmedEmail?: boolean;
}

const localActor: AuthenticatedActor = {
  userId: "local-user",
  email: "local@smartbio.dev",
  workspaceId: "local-workspace",
  role: "owner",
  persistence: "memory",
};

function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const resolveActor = cache(async (): Promise<AuthenticatedActor | null> => {
  if (!isSupabaseServerConfigured()) {
    if (canUseLocalAuth()) return localActor;
    if (process.env.NODE_ENV === "production") throw new ProductionConfigurationError();
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { /* Server Components may not write refreshed cookies. */ }
        },
      },
    },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return canUseLocalAuth() ? localActor : null;
  if (!user.email_confirmed_at) throw new EmailNotConfirmedError();

  const service = createServiceClient();
  if (!service) throw new ProductionConfigurationError();
  const { data, error: membershipError } = await service
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new WorkspaceRequiredError();
  const membership = data?.workspace_id ? data : await ensureUserWorkspace(user);
  return {
    userId: user.id,
    email: user.email || "",
    workspaceId: "workspaceId" in membership ? membership.workspaceId : membership.workspace_id,
    role: membership.role === "owner" ? "owner" : "member",
    persistence: "database",
  };
});

export async function getOptionalActor(options: ActorOptions = {}) {
  const actor = await resolveActor();
  if (actor && options.workspaceId && actor.workspaceId !== options.workspaceId) throw new WorkspaceAccessDeniedError();
  return actor;
}

export async function requireAuthenticatedActor(options: ActorOptions = {}) {
  const actor = await getOptionalActor(options);
  if (!actor) throw new AuthenticationRequiredError();
  return actor;
}

export const getAISetupActor = requireAuthenticatedActor;
