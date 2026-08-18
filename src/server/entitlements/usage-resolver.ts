import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntitlementFeature } from "./entitlement-catalog";

export async function resolveFeatureUsage(
  database: SupabaseClient,
  workspaceId: string,
  feature: EntitlementFeature,
  plan?: { key: string; assignedAt?: string },
) {
  const count = async (
    table: string,
    filters?: { status?: string[]; createdAfter?: string },
  ) => {
    let query = database
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (filters?.status) query = query.in("status", filters.status);
    if (filters?.createdAfter)
      query = query.gte("created_at", filters.createdAfter);
    const { count: total, error } = await query;
    if (error) throw error;
    return total || 0;
  };
  switch (feature) {
    case "projects":
      return count("projects");
    case "team_members":
      return count("workspace_members");
    case "active_activations":
      return count("conversion_activations", { status: ["active", "scheduled"] });
    case "presence_pages": {
      const { data: projects } = await database
        .from("projects")
        .select("id")
        .eq("workspace_id", workspaceId);
      const ids = (projects || []).map((project) => project.id);
      if (!ids.length) return 0;
      const { count: total, error } = await database
        .from("presence_pages")
        .select("id", { count: "exact", head: true })
        .in("project_id", ids);
      if (error) throw error;
      return total || 0;
    }
    case "presence_sections_per_page": {
      const { data: projects } = await database
        .from("projects")
        .select("id")
        .eq("workspace_id", workspaceId);
      const projectIds = (projects || []).map((project) => project.id);
      if (!projectIds.length) return 0;
      const { data: pages, error: pageError } = await database
        .from("presence_pages")
        .select("id")
        .in("project_id", projectIds);
      if (pageError) throw pageError;
      const pageIds = (pages || []).map((page) => page.id);
      if (!pageIds.length) return 0;
      const { data: sections, error } = await database
        .from("presence_sections")
        .select("page_id")
        .in("page_id", pageIds);
      if (error) throw error;
      const totals = new Map<string, number>();
      for (const section of sections || [])
        totals.set(section.page_id, (totals.get(section.page_id) || 0) + 1);
      return Math.max(0, ...totals.values());
    }
    case "ai_generations_month": {
      if (plan?.key === "trial")
        return count("ai_generation_runs", { createdAfter: plan.assignedAt });
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      return count("ai_generation_runs", { createdAfter: start.toISOString() });
    }
    default:
      return 0;
  }
}
