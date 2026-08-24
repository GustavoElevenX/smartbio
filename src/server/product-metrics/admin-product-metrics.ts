import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export async function getAdminProductMetrics(database: SupabaseClient, days = 30) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const [lifecycle, projects, productState, assignments, subscriptions] = await Promise.all([
    database.from("platform_marketing_events").select("workspace_id,user_id,event_name,created_at").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    database.from("projects").select("id,workspace_id,status,published_at").neq("status", "archived"),
    database.from("project_member_product_state").select("workspace_id,user_id,last_overview_seen_at,last_analytics_seen_at,last_optimization_seen_at"),
    database.from("workspace_plan_assignments").select("workspace_id,plan_key,ends_at,created_at"),
    database.from("subscriptions").select("workspace_id,status,created_at"),
  ]);
  const failed = [lifecycle, projects, productState, assignments, subscriptions].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const events = lifecycle.data || [];
  const unique = (name: string) => new Set(events.filter((event) => event.event_name === name).map((event) => event.workspace_id || event.user_id).filter(Boolean));
  const counts = (names: string[]) => Object.fromEntries(names.map((name) => [name, unique(name).size]));
  const milestones = new Map<string, Map<string, number>>();
  for (const event of events) {
    const key = event.workspace_id || event.user_id;
    if (!key) continue;
    const map = milestones.get(key) || new Map<string, number>();
    const at = new Date(event.created_at).getTime();
    map.set(event.event_name, Math.min(map.get(event.event_name) || at, at));
    milestones.set(key, map);
  }
  const elapsed = (from: string, to: string) => [...milestones.values()].flatMap((map) => map.has(from) && map.has(to) ? [map.get(to)! - map.get(from)!] : []);
  const publishedProjects = (projects.data || []).filter((project) => project.status === "published");
  const publishedWorkspaces = new Set(publishedProjects.map((project) => project.workspace_id));
  const returnedWorkspaces = new Set((productState.data || []).filter((state) => [state.last_overview_seen_at, state.last_analytics_seen_at].some((date) => date && new Date(date) >= start)).map((state) => state.workspace_id).filter((id) => publishedWorkspaces.has(id)));
  const analyticsViewed = unique("analytics_viewed");
  const optimizationViewed = unique("optimization_viewed");
  const conversionConfirmed = unique("first_conversion_confirmed");
  const trial = new Set((assignments.data || []).filter((assignment) => assignment.plan_key === "trial").map((assignment) => assignment.workspace_id));
  const paid = new Set((subscriptions.data || []).filter((subscription) => ["active", "past_due"].includes(subscription.status)).map((subscription) => subscription.workspace_id));
  const opportunity = unique("first_opportunity_generated");
  const traffic = unique("first_traffic_received");
  const paywall = unique("paywall_viewed");
  const checkout = unique("checkout_started");
  const activationCounts = counts(["account_created", "onboarding_started", "onboarding_completed", "first_structure_generated", "first_project_published", "first_traffic_received", "first_opportunity_generated", "first_conversion_confirmed"]);
  return {
    activation: {
      ...activationCounts,
      medianAccountToStructureMs: median(elapsed("account_created", "first_structure_generated")),
      medianStructureToPublishedMs: median(elapsed("first_structure_generated", "first_project_published")),
      medianAccountToPublishedMs: median(elapsed("account_created", "first_project_published")),
      medianPublishedToTrafficMs: median(elapsed("first_project_published", "first_traffic_received")),
      medianTrafficToOpportunityMs: median(elapsed("first_traffic_received", "first_opportunity_generated")),
    },
    usage: {
      publishedWorkspaces: publishedWorkspaces.size,
      returnedWorkspaces: returnedWorkspaces.size,
      analyticsViewed: [...analyticsViewed].filter((id) => publishedWorkspaces.has(String(id))).length,
      optimizationViewed: [...optimizationViewed].filter((id) => publishedWorkspaces.has(String(id))).length,
      conversionConfirmed: [...conversionConfirmed].filter((id) => publishedWorkspaces.has(String(id))).length,
    },
    wtp: {
      trialStarted: trial.size, paywallViewed: paywall.size, checkoutStarted: checkout.size, paid: paid.size,
      noTraffic: [...trial].filter((id) => !traffic.has(id)).length,
      trafficWithoutOpportunity: [...trial].filter((id) => traffic.has(id) && !opportunity.has(id)).length,
      withOpportunity: [...trial].filter((id) => opportunity.has(id)).length,
      withConfirmedConversion: [...trial].filter((id) => conversionConfirmed.has(id)).length,
      valueExposedPaid: [...paid].filter((id) => opportunity.has(id)).length,
    },
    period: { start: start.toISOString(), end: end.toISOString(), days },
  };
}
