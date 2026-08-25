import { createServiceClient } from "@/lib/supabase/server";
import { ENTITLEMENT_FEATURES } from "@/server/entitlements/entitlement-catalog";
import { resolveWorkspaceEntitlements } from "@/server/entitlements/entitlement-resolver";
import type { WorkspaceEntitlements } from "@/server/entitlements/entitlement-types";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") {
    const features: WorkspaceEntitlements["features"] = Object.fromEntries(
      ENTITLEMENT_FEATURES.map((feature) => [
        feature,
        { enabled: true, used: 0, source: "plan" as const },
      ]),
    );
    return apiSuccess({
      workspaceId: actor.workspaceId,
      plan: {
        key: "trial",
        name: "Teste grátis",
        source: "system" as const,
        status: "active" as const,
      },
      features,
    } satisfies WorkspaceEntitlements);
  }

  const database = createServiceClient();
  if (!database)
    return apiError("Banco de dados indisponível.", 503, "database_required");
  return apiSuccess(
    await resolveWorkspaceEntitlements(database, actor.workspaceId),
  );
});
