import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export class PlatformAdminRepository {
  constructor(private db: SupabaseClient) {}
  async overview(days = 30) {
    const end = new Date(),
      start = new Date(end.getTime() - days * 86400000);
    const [{ data: metrics, error }, { data: funnel, error: funnelError }] =
      await Promise.all([
        this.db.rpc("get_platform_overview_metrics", {
          period_start: start.toISOString(),
          period_end: end.toISOString(),
        }),
        this.db.rpc("get_platform_activation_funnel", {
          period_start: start.toISOString(),
          period_end: end.toISOString(),
        }),
      ]);
    if (error) throw error;
    if (funnelError) throw funnelError;
    return { metrics, funnel };
  }
  async health(days = 30) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return this.db.rpc("get_platform_workspace_health", {
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    });
  }
  async workspaceDetail(workspaceId: string, days = 30) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const { data, error } = await this.db.rpc(
      "get_platform_workspace_detail_metrics",
      {
        target_workspace: workspaceId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
      },
    );
    if (error) throw error;
    return data as {
      pages: number;
      activations: number;
      activeActivations: number;
      opportunities30d: number;
      conversions30d: number;
      confirmedValue30d: number;
      lastActivityAt: string | null;
    };
  }
  async users(page = 1, search = "") {
    let q = this.db
      .from("profiles")
      .select("id,full_name,email,created_at,last_seen_at,account_status", {
        count: "exact",
      })
      .range((page - 1) * 25, page * 25 - 1)
      .order("created_at", { ascending: false });
    if (search)
      q = q.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,id.eq.${search}`,
      );
    return q;
  }
  async workspaces(page = 1) {
    return this.db
      .from("workspaces")
      .select(
        "id,name,slug,account_status,created_at,workspace_plan_assignments(plan_key,source,status)",
        { count: "exact" },
      )
      .range((page - 1) * 25, page * 25 - 1)
      .order("created_at", { ascending: false });
  }
  async projects(page = 1) {
    return this.db
      .from("projects")
      .select("id,name,slug,status,workspace_id,updated_at", { count: "exact" })
      .range((page - 1) * 25, page * 25 - 1)
      .order("updated_at", { ascending: false });
  }
}
