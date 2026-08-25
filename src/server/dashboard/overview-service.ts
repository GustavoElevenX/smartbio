import "server-only";

import { demoProjects } from "@/data/demo-projects";
import { resolveAppUrl } from "@/lib/app-url";
import { publicProjectUrl } from "@/lib/public-url";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
import { EMPTY_OPERATIONAL_TOTALS, type OperationalProject, type WorkspaceOperationalOverview } from "@/features/dashboard/operational-overview";

const number = (value: unknown) => Number(value || 0);

async function fallbackOperationalOverview(
  database: NonNullable<ReturnType<typeof createServiceClient>>,
  actor: AuthenticatedActor,
  now: Date,
): Promise<WorkspaceOperationalOverview> {
  const { data, error } = await database
    .from("projects")
    .select("id,name,slug,status,published_at,updated_at")
    .eq("workspace_id", actor.workspaceId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Não foi possível carregar os negócios: ${error.message}`);
  const baseUrl = resolveAppUrl();
  const projects: OperationalProject[] = (data || []).map((project) => ({
    ...EMPTY_OPERATIONAL_TOTALS,
    id: String(project.id),
    name: String(project.name),
    slug: String(project.slug),
    status: project.status === "published" ? "published" : "draft",
    publishedAt: project.published_at ? String(project.published_at) : undefined,
    updatedAt: String(project.updated_at),
    publicUrl: publicProjectUrl(String(project.slug), baseUrl),
  }));
  return {
    periodStart: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    periodEnd: now.toISOString(),
    hasPreviousVisit: false,
    totals: EMPTY_OPERATIONAL_TOTALS,
    projects,
    learnings: [],
  };
}

export async function getWorkspaceOperationalOverview(actor: AuthenticatedActor): Promise<WorkspaceOperationalOverview> {
  const now = new Date();
  if (actor.persistence === "memory") {
    const projects: OperationalProject[] = demoProjects.map((project) => ({
      ...EMPTY_OPERATIONAL_TOTALS,
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status === "published" ? "published" : "draft",
      publishedAt: project.publishedAt,
      updatedAt: project.updatedAt,
      publicUrl: publicProjectUrl(project.slug, resolveAppUrl()),
    }));
    return { periodStart: new Date(now.getTime() - 7 * 86_400_000).toISOString(), periodEnd: now.toISOString(), hasPreviousVisit: false, totals: EMPTY_OPERATIONAL_TOTALS, projects, learnings: [] };
  }
  const database = createServiceClient();
  if (!database) throw new Error("Supabase não configurado.");
  const [{ data, error }, experiments] = await Promise.all([
    database.rpc("get_workspace_operational_overview", { target_workspace: actor.workspaceId, target_user: actor.userId, observed_at: now.toISOString() }),
    database.from("optimization_experiments").select("id,target_metric,result,baseline_metrics,candidate_metrics,delta_metrics,evaluation_method").eq("workspace_id", actor.workspaceId).eq("status", "evaluated").order("evaluated_at", { ascending: false }).limit(5),
  ]);
  if (error) {
    if (["PGRST202", "42883", "42703"].includes(error.code || ""))
      return fallbackOperationalOverview(database, actor, now);
    throw new Error(`Não foi possível carregar a visão operacional: ${error.message}`);
  }
  const raw = (data || {}) as Record<string, unknown>;
  const rawTotals = (raw.totals || {}) as Record<string, unknown>;
  const totals = {
    sessions: number(rawTotals.sessions), intentions: number(rawTotals.intentions), actions: number(rawTotals.actions),
    externalActions: number(rawTotals.externalActions), opportunities: number(rawTotals.opportunities),
    conversions: number(rawTotals.conversions), confirmedValue: number(rawTotals.confirmedValue),
  };
  const baseUrl = resolveAppUrl();
  const projects = ((raw.projects || []) as Array<Record<string, unknown>>).map((project): OperationalProject => ({
    id: String(project.id), name: String(project.name), slug: String(project.slug),
    status: project.status === "published" ? "published" : "draft",
    publishedAt: project.publishedAt ? String(project.publishedAt) : undefined,
    updatedAt: String(project.updatedAt), publicUrl: publicProjectUrl(String(project.slug), baseUrl),
    sessions: number(project.sessions), intentions: number(project.intentions), actions: number(project.actions),
    externalActions: number(project.externalActions), opportunities: number(project.opportunities),
    conversions: number(project.conversions), confirmedValue: number(project.confirmedValue),
  }));
  const metricLabel: Record<string, string> = { intention_rate: "taxa de intenção", action_rate: "taxa de ação", opportunity_rate: "taxa de oportunidade", conversion_rate: "taxa de conversão", confirmed_value_per_session: "valor confirmado por sessão" };
  const learnings = (experiments.error ? [] : experiments.data || []).map((experiment) => {
    const delta = Number((experiment.delta_metrics as Record<string, unknown> | null)?.absolute || 0);
    const sessionsBefore = Number((experiment.baseline_metrics as Record<string, unknown> | null)?.sessions || 0);
    const sessionsAfter = Number((experiment.candidate_metrics as Record<string, unknown> | null)?.sessions || 0);
    const isValue = experiment.target_metric === "confirmed_value_per_session";
    const formattedDelta = isValue ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(delta)) : `${(Math.abs(delta) * 100).toFixed(1)} p.p.`;
    const direction = experiment.result === "positive" ? "maior" : experiment.result === "negative" ? "menor" : "praticamente estável";
    return { id: String(experiment.id), statement: `Na janela observada, a ${metricLabel[experiment.target_metric] || experiment.target_metric} ficou ${direction}${experiment.result === "neutral" ? "" : ` em ${formattedDelta}`}.`, evidence: `${sessionsBefore} sessões antes · ${sessionsAfter} depois · comparação observacional` };
  });
  return {
    periodStart: String(raw.periodStart || new Date(now.getTime() - 7 * 86_400_000).toISOString()),
    periodEnd: String(raw.periodEnd || now.toISOString()),
    hasPreviousVisit: Boolean(raw.hasPreviousVisit), totals, projects, learnings,
  };
}
