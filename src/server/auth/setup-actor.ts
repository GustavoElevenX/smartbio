import "server-only";

import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canUseLocalAuth } from "@/lib/runtime-mode";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/server/auth/workspace-bootstrap";
import { ACTIVE_WORKSPACE_COOKIE } from "@/server/auth/active-workspace";
import { touchUserActivity } from "@/server/activity/touch-user-activity";
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
  mode: "workspace" | "platform_support";
  platform?: {
    role: "super_admin" | "support_admin";
    supportSessionId?: string;
    realUserId: string;
  };
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
  mode: "workspace",
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
    if (process.env.NODE_ENV === "production")
      throw new ProductionConfigurationError();
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
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* Server Components may not write refreshed cookies. */
          }
        },
      },
    },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return canUseLocalAuth() ? localActor : null;
  if (!user.email_confirmed_at) throw new EmailNotConfirmedError();

  const service = createServiceClient();
  if (!service) throw new ProductionConfigurationError();
  const { data: profile } = await service
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .single();
  if (profile?.account_status === "suspended")
    throw new WorkspaceAccessDeniedError("Esta conta está suspensa.");
  void touchUserActivity(service, user.id);

  const supportSessionId = cookieStore.get("virou_support_session")?.value;
  if (supportSessionId) {
    const { data: support } = await service
      .from("platform_support_sessions")
      .select(
        "id,workspace_id,expires_at,platform_support_grants!inner(can_read,revoked_at,expires_at)",
      )
      .eq("id", supportSessionId)
      .eq("admin_user_id", user.id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    const { data: admin } = support
      ? await service
          .from("platform_admins")
          .select("role,is_active")
          .eq("user_id", user.id)
          .maybeSingle()
      : { data: null };
    const validGrant = (support?.platform_support_grants || []).some(
      (grant) =>
        grant.can_read &&
        !grant.revoked_at &&
        new Date(grant.expires_at) > new Date(),
    );
    if (support && admin?.is_active && validGrant) {
      return {
        userId: user.id,
        email: user.email || "",
        workspaceId: support.workspace_id,
        role: "member",
        persistence: "database",
        mode: "platform_support",
        platform: {
          role: admin.role,
          supportSessionId: support.id,
          realUserId: user.id,
        },
      };
    }
  }

  const { data, error: membershipError } = await service
    .from("workspace_members")
    .select("workspace_id,role,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (membershipError) throw new WorkspaceRequiredError();
  const memberships = data || [];
  const requestedWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const requested = memberships.find(
    (item) => item.workspace_id === requestedWorkspaceId,
  );
  const membership =
    requested ||
    memberships.find((item) => item.role === "owner") ||
    memberships[0];
  if (!membership) {
    const created = await ensureUserWorkspace(user);
    return {
      userId: user.id,
      email: user.email || "",
      workspaceId: created.workspaceId,
      role: created.role,
      persistence: "database",
      mode: "workspace",
    };
  }
  return {
    userId: user.id,
    email: user.email || "",
    workspaceId: membership.workspace_id,
    role: membership.role === "owner" ? "owner" : "member",
    persistence: "database",
    mode: "workspace",
  };
});

export async function getOptionalActor(options: ActorOptions = {}) {
  const actor = await resolveActor();
  if (actor && options.workspaceId && actor.workspaceId !== options.workspaceId)
    throw new WorkspaceAccessDeniedError();
  return actor;
}

export async function requireAuthenticatedActor(options: ActorOptions = {}) {
  const actor = await getOptionalActor(options);
  if (!actor) throw new AuthenticationRequiredError();
  return actor;
}

export const getAISetupActor = requireAuthenticatedActor;
