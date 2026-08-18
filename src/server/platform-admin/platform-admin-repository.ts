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
  private period(days = 30) {
    const end = new Date();
    return { start: new Date(end.getTime() - days * 86_400_000), end };
  }
  async growth(days = 30) {
    const { start, end } = this.period(days);
    const [{ data: overview, error }, { data: funnel, error: funnelError }] =
      await Promise.all([
        this.db.rpc("get_platform_growth_overview", {
          period_start: start.toISOString(),
          period_end: end.toISOString(),
        }),
        this.db.rpc("get_platform_growth_funnel", {
          period_start: start.toISOString(),
          period_end: end.toISOString(),
        }),
      ]);
    if (error) throw error;
    if (funnelError) throw funnelError;
    return { overview, funnel };
  }
  async acquisition(days = 30) {
    const { start, end } = this.period(days);
    const [growth, sources, ctas, paths, referrers] = await Promise.all([
      this.growth(days),
      this.db.rpc("get_platform_acquisition_sources", { period_start: start.toISOString(), period_end: end.toISOString() }),
      this.db.rpc("get_platform_marketing_ctas", { period_start: start.toISOString(), period_end: end.toISOString() }),
      this.db.from("platform_marketing_events").select("path,visitor_id,session_id,event_name").gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).in("event_name", ["marketing_page_viewed", "marketing_cta_clicked"]),
      this.db.from("platform_marketing_sessions").select("referrer,visitor_id").gte("started_at", start.toISOString()).lt("started_at", end.toISOString()),
    ]);
    if (sources.error) throw sources.error;
    if (ctas.error) throw ctas.error;
    if (paths.error) throw paths.error;
    if (referrers.error) throw referrers.error;
    const pathMap = new Map<string, { path: string; views: number; visitors: Set<string>; clicks: number }>();
    for (const event of paths.data || []) {
      const key = event.path || "/";
      const item = pathMap.get(key) || { path: key, views: 0, visitors: new Set<string>(), clicks: 0 };
      if (event.event_name === "marketing_page_viewed") item.views += 1;
      if (event.event_name === "marketing_cta_clicked") item.clicks += 1;
      if (event.visitor_id) item.visitors.add(event.visitor_id);
      pathMap.set(key, item);
    }
    const referrerMap = new Map<string, Set<string>>();
    for (const session of referrers.data || []) {
      let label = "Direct";
      try { if (session.referrer) label = new URL(session.referrer).hostname.replace(/^www\./, ""); } catch { label = session.referrer || "Direct"; }
      const visitors = referrerMap.get(label) || new Set<string>();
      visitors.add(session.visitor_id);
      referrerMap.set(label, visitors);
    }
    return {
      ...growth,
      sources: sources.data || [],
      ctas: ctas.data || [],
      paths: [...pathMap.values()].map((item) => ({ ...item, visitors: item.visitors.size, signupRate: 0 })).sort((a, b) => b.views - a.views),
      referrers: [...referrerMap.entries()].map(([referrer, visitors]) => ({ referrer, visitors: visitors.size })).sort((a, b) => b.visitors - a.visitors),
    };
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
  async workspaceEngagement(workspaceId: string, projectIds: string[]) {
    const { start: start7 } = this.period(7);
    const { start: start30 } = this.period(30);
    const emptyCount = Promise.resolve({ count: 0 });
    const [sessions7, sessions30, views7, views30, opportunities7] = await Promise.all([
      projectIds.length ? this.db.from("visitor_sessions").select("id", { count: "exact", head: true }).in("project_id", projectIds).gte("started_at", start7.toISOString()) : emptyCount,
      projectIds.length ? this.db.from("visitor_sessions").select("id", { count: "exact", head: true }).in("project_id", projectIds).gte("started_at", start30.toISOString()) : emptyCount,
      projectIds.length ? this.db.from("analytics_events").select("id", { count: "exact", head: true }).in("project_id", projectIds).eq("event_name", "page_view").gte("created_at", start7.toISOString()) : emptyCount,
      projectIds.length ? this.db.from("analytics_events").select("id", { count: "exact", head: true }).in("project_id", projectIds).eq("event_name", "page_view").gte("created_at", start30.toISOString()) : emptyCount,
      this.db.from("commercial_opportunities").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).gte("created_at", start7.toISOString()),
    ]);
    return { sessions7: sessions7.count || 0, sessions30: sessions30.count || 0, views7: views7.count || 0, views30: views30.count || 0, opportunities7: opportunities7.count || 0 };
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
    const result = await q;
    const ids = (result.data || []).map((user) => user.id);
    if (!ids.length) return { ...result, data: [] };
    const [memberships, attribution] = await Promise.all([
      this.db.from("workspace_members").select("user_id,workspace_id,workspaces(id,workspace_plan_assignments(plan_key,status),subscriptions(status,provider),projects(id,status,presence_pages(id)))").in("user_id", ids),
      this.db.from("platform_signup_attribution").select("user_id,first_touch,signup_touch").in("user_id", ids),
    ]);
    const attributionByUser = new Map((attribution.data || []).map((item) => [item.user_id, item]));
    const membershipByUser = new Map<string, typeof memberships.data>();
    for (const membership of memberships.data || []) {
      const list = membershipByUser.get(membership.user_id) || [];
      list.push(membership);
      membershipByUser.set(membership.user_id, list);
    }
    return {
      ...result,
      data: (result.data || []).map((user) => {
        const userMemberships = membershipByUser.get(user.id) || [];
        const workspaces = userMemberships.flatMap((membership) => Array.isArray(membership.workspaces) ? membership.workspaces : membership.workspaces ? [membership.workspaces] : []);
        const projects = workspaces.flatMap((workspace) => workspace.projects || []);
        const assignment = workspaces.flatMap((workspace) => Array.isArray(workspace.workspace_plan_assignments) ? workspace.workspace_plan_assignments : workspace.workspace_plan_assignments ? [workspace.workspace_plan_assignments] : [])[0];
        const subscription = workspaces.flatMap((workspace) => workspace.subscriptions || [])[0];
        const firstTouch = attributionByUser.get(user.id)?.first_touch as Record<string, string> | undefined;
        return {
          ...user,
          plan: assignment?.plan_key || "—",
          subscriptionStatus: subscription?.status || "—",
          source: firstTouch?.source || "Direct",
          campaign: firstTouch?.campaign || "—",
          projects: projects.length,
          pages: projects.reduce((total, project) => total + (project.presence_pages?.length || 0), 0),
          published: projects.some((project) => project.status === "published"),
        };
      }),
    };
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
  async pages(page = 1, days = 30) {
    const { start, end } = this.period(days);
    const result = await this.db
      .from("presence_pages")
      .select("id,name,path,is_home,is_active,updated_at,projects!inner(id,name,slug,status,workspace_id,workspaces(name,owner_id))", { count: "exact" })
      .range((page - 1) * 25, page * 25 - 1)
      .order("updated_at", { ascending: false });
    const projectIds = (result.data || []).map((page) => {
      const project = Array.isArray(page.projects) ? page.projects[0] : page.projects;
      return project?.id;
    }).filter(Boolean);
    const [sessions, events, opportunities] = projectIds.length ? await Promise.all([
      this.db.from("visitor_sessions").select("project_id").in("project_id", projectIds).gte("started_at", start.toISOString()).lt("started_at", end.toISOString()),
      this.db.from("analytics_events").select("project_id,event_name").in("project_id", projectIds).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
      this.db.from("commercial_opportunities").select("project_id").in("project_id", projectIds).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()),
    ]) : [{ data: [] }, { data: [] }, { data: [] }];
    const countBy = (rows: Array<Record<string, unknown>>, projectId: string, predicate: (row: Record<string, unknown>) => boolean = () => true) => rows.filter((row) => row.project_id === projectId && predicate(row)).length;
    return {
      ...result,
      data: (result.data || []).map((page) => {
        const project = Array.isArray(page.projects) ? page.projects[0] : page.projects;
        return {
          ...page,
          project,
          views30d: countBy((sessions.data || []) as Array<Record<string, unknown>>, project?.id || ""),
          ctaClicks30d: countBy((events.data || []) as Array<Record<string, unknown>>, project?.id || "", (row) => ["cta_clicked", "action_clicked", "journey_completed"].includes(String(row.event_name))),
          opportunities30d: countBy((opportunities.data || []) as Array<Record<string, unknown>>, project?.id || ""),
        };
      }),
    };
  }
  async user360(userId: string, days = 90) {
    const { start, end } = this.period(days);
    const { data, error } = await this.db.rpc("get_platform_user_360", {
      target_user: userId,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
    });
    if (error) throw error;
    return data as Record<string, unknown> | null;
  }
}
