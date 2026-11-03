import "server-only";

import { createServiceClient } from "@/lib/supabase/server";
import {
  trafficMilestoneForCount,
  type CommercialNotificationEvent,
} from "@/server/notifications/notification-events";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { notificationTemplate } from "@/server/notifications/notification-templates";

interface MaterializedNotification {
  eventKey: CommercialNotificationEvent;
  projectId?: string;
  objectType: string;
  objectId: string;
  actionUrl: string;
  data: Record<string, unknown>;
}

function keyOf(item: Pick<MaterializedNotification, "eventKey" | "objectType" | "objectId">) {
  return `${item.eventKey}:${item.objectType}:${item.objectId}`;
}

function endingSoon(value?: string | null, days = 7) {
  if (!value) return false;
  const remaining = new Date(value).getTime() - Date.now();
  return remaining > 0 && remaining <= days * 24 * 60 * 60 * 1_000;
}

export async function materializeUserNotifications(workspaceId: string, userId: string) {
  const database = createServiceClient();
  if (!database) return;

  const [projectsResult, leadsResult, subscriptionResult, planResult, existingResult] = await Promise.all([
    database.from("projects").select("id,name,slug,status,published_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(20),
    database.from("leads").select("id,project_id,name,phone,recommendation,location_name,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(10),
    database.from("subscriptions").select("id,status,current_period_end,cancel_at_period_end").eq("workspace_id", workspaceId).maybeSingle(),
    database.from("workspace_plan_assignments").select("id,plan_key,status,ends_at").eq("workspace_id", workspaceId).maybeSingle(),
    database.from("notifications").select("event_key,object_type,object_id").eq("workspace_id", workspaceId).eq("user_id", userId),
  ]);

  const projects = projectsResult.data || [];
  const publishedProjects = projects.filter((project) => project.status === "published" && project.published_at);
  const existing = new Set(
    (existingResult.data || []).map((item) => `${item.event_key}:${item.object_type}:${item.object_id}`),
  );
  const candidates: MaterializedNotification[] = [];

  for (const project of publishedProjects) {
    candidates.push({
      eventKey: "project.published",
      projectId: project.id,
      objectType: "project",
      objectId: project.id,
      actionUrl: `/app/projects/${project.id}/site`,
      data: { projectName: project.name, slug: project.slug },
    });
  }

  const trafficResults = await Promise.all(
    publishedProjects.map(async (project) => {
      const result = await database
        .from("visitor_sessions")
        .select("id,started_at", { count: "exact" })
        .eq("project_id", project.id)
        .order("started_at", { ascending: false })
        .limit(1);
      return { project, count: result.count || 0, latestAt: result.data?.[0]?.started_at };
    }),
  );
  for (const traffic of trafficResults) {
    const milestone = trafficMilestoneForCount(traffic.count);
    if (!milestone) continue;
    candidates.push({
      eventKey: "traffic.milestone_reached",
      projectId: traffic.project.id,
      objectType: "traffic_milestone",
      objectId: `${traffic.project.id}:${milestone}`,
      actionUrl: `/app/projects/${traffic.project.id}/analytics`,
      data: { projectName: traffic.project.name, count: milestone, observedCount: traffic.count, latestAt: traffic.latestAt },
    });
  }

  for (const lead of leadsResult.data || []) {
    candidates.push({
      eventKey: "lead.created",
      projectId: lead.project_id,
      objectType: "lead",
      objectId: lead.id,
      actionUrl: `/app/projects/${lead.project_id}/opportunities`,
      data: {
        visitorName: lead.name,
        phone: lead.phone,
        interest: lead.recommendation,
        location: lead.location_name,
      },
    });
  }

  const subscription = subscriptionResult.data;
  if (subscription && ["active", "trialing"].includes(subscription.status)) {
    candidates.push({
      eventKey: "subscription.activated",
      objectType: "subscription",
      objectId: subscription.id,
      actionUrl: "/app/settings/billing",
      data: { plan: "SOBE Pro" },
    });
    if (subscription.cancel_at_period_end && endingSoon(subscription.current_period_end)) {
      candidates.push({
        eventKey: "subscription.ending",
        objectType: "subscription_ending",
        objectId: subscription.id,
        actionUrl: "/app/settings/billing",
        data: { endingAt: subscription.current_period_end, autoRenew: false },
      });
    }
  }

  const plan = planResult.data;
  if (plan?.plan_key === "trial" && plan.status === "active" && endingSoon(plan.ends_at, 3)) {
    candidates.push({
      eventKey: "trial.ending",
      objectType: "plan_assignment",
      objectId: plan.id,
      actionUrl: "/app/settings/billing",
      data: { endingAt: plan.ends_at },
    });
  }

  for (const candidate of candidates) {
    if (existing.has(keyOf(candidate))) continue;
    const preference = await notificationRepository.preference(workspaceId, userId, candidate.eventKey);
    if (!preference.inApp) continue;
    const template = notificationTemplate(candidate.eventKey, candidate.data, candidate.actionUrl);
    await notificationRepository.create({
      workspaceId,
      projectId: candidate.projectId,
      userId,
      eventKey: candidate.eventKey,
      title: template.title,
      body: template.body,
      actionUrl: candidate.actionUrl,
      objectType: candidate.objectType,
      objectId: candidate.objectId,
      metadata: candidate.data,
    });
    existing.add(keyOf(candidate));
  }
}
