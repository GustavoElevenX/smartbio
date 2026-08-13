import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export class EntitlementRepository {
  constructor(private readonly database: SupabaseClient) {}
  async load(workspaceId: string) {
    const now = new Date().toISOString();
    const [
      { data: assignment, error: aError },
      { data: overrides, error: oError },
    ] = await Promise.all([
      this.database
        .from("workspace_plan_assignments")
        .select(
          "*,plan_catalog(name,plan_entitlements(feature_key,enabled,limit_value))",
        )
        .eq("workspace_id", workspaceId)
        .single(),
      this.database
        .from("workspace_entitlement_overrides")
        .select("feature_key,enabled_override,limit_override")
        .eq("workspace_id", workspaceId)
        .is("revoked_at", null)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`),
    ]);
    if (aError) throw aError;
    if (oError) throw oError;
    const catalog = Array.isArray(assignment.plan_catalog)
      ? assignment.plan_catalog[0]
      : assignment.plan_catalog;
    return {
      assignment: {
        ...assignment,
        plan_catalog: catalog ? { name: catalog.name } : null,
        plan_entitlements: catalog?.plan_entitlements || [],
      },
      overrides: overrides || [],
    };
  }
}
