import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceEntitlements } from "./entitlement-types";
import {
  ENTITLEMENT_FEATURES,
  type EntitlementFeature,
} from "./entitlement-catalog";
import { EntitlementRepository } from "./entitlement-repository";
import { resolveFeatureUsage } from "./usage-resolver";
interface PlanRow {
  feature_key: string;
  enabled: boolean;
  limit_value: number | string | null;
}
interface OverrideRow {
  feature_key: string;
  enabled_override: boolean | null;
  limit_override: number | string | null;
}
const metered = new Set<EntitlementFeature>([
  "projects",
  "presence_pages",
  "active_activations",
  "team_members",
  "ai_generations_month",
]);
export async function resolveWorkspaceEntitlements(
  database: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceEntitlements> {
  const { assignment, overrides } = await new EntitlementRepository(
    database,
  ).load(workspaceId);
  const effectiveStatus =
    assignment.status === "active" &&
    assignment.ends_at &&
    new Date(assignment.ends_at) <= new Date()
      ? "expired"
      : assignment.status;
  const planEntitlements = new Map<string, PlanRow>(
    (assignment.plan_entitlements || []).map((x: PlanRow) => [
      x.feature_key,
      x,
    ]),
  );
  const overrideMap = new Map<string, OverrideRow>(
    (overrides as OverrideRow[]).map((x) => [x.feature_key, x]),
  );
  const features: WorkspaceEntitlements["features"] = {};
  await Promise.all(
    ENTITLEMENT_FEATURES.map(async (feature) => {
      const plan = planEntitlements.get(feature);
      const override = overrideMap.get(feature);
      let enabled = effectiveStatus === "active" && Boolean(plan?.enabled);
      let limit =
        plan?.limit_value == null ? undefined : Number(plan.limit_value);
      let source: "plan" | "override" = "plan";
      if (override) {
        enabled = override.enabled_override ?? enabled;
        limit =
          override.limit_override == null
            ? limit
            : Number(override.limit_override);
        source = "override";
      }
      const used = metered.has(feature)
        ? await resolveFeatureUsage(database, workspaceId, feature)
        : undefined;
      features[feature] = {
        enabled,
        limit,
        used,
        remaining:
          limit == null || used == null ? undefined : Math.max(0, limit - used),
        source,
      };
    }),
  );
  return {
    workspaceId,
    plan: {
      key: assignment.plan_key,
      name: assignment.plan_catalog?.name || assignment.plan_key,
      source: assignment.source,
      status: effectiveStatus,
      endsAt: assignment.ends_at || undefined,
    },
    features,
  };
}
