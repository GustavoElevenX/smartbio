import Link from "next/link";
import { AdminPeriod, GrowthFunnel, MetricStrip, type FunnelStep } from "@/components/platform-admin/admin-metrics";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";

interface GrowthOverview {
  uniqueVisitors: number; sessions: number; ctaClicks: number; accountsCreated: number;
  workspacesActivated: number; projectsCreated: number; projectsPublished: number; paidSubscriptions: number;
  usersTotal: number; workspacesTotal: number; projectsTotal: number; publishedTotal: number;
  inactiveWorkspaces: number; recentUsers: number;
}

function rate(part: number, total: number) { return total ? `${(part * 100 / total).toFixed(1)}%` : "0%"; }

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const repository = new PlatformAdminRepository(createServiceClient()!);
  const [{ overview, funnel }, health] = await Promise.all([repository.growth(days), repository.health(days)]);
  const metrics = (overview || {}) as GrowthOverview;
  const healthRows = (health.data || []) as Array<{ health_state: string }>;
  const healthCount = (state: string) => healthRows.filter((row) => row.health_state === state).length;
  const primary = [
    { label: "Visitantes únicos", value: metrics.uniqueVisitors || 0 },
    { label: "Sessões", value: metrics.sessions || 0 },
    { label: "Cliques em botões de ação", value: metrics.ctaClicks || 0, detail: `${rate(metrics.ctaClicks, metrics.uniqueVisitors)} dos visitantes` },
    { label: "Contas criadas", value: metrics.accountsCreated || 0, detail: `${rate(metrics.accountsCreated, metrics.uniqueVisitors)} dos visitantes` },
    { label: "Espaços de trabalho ativados", value: metrics.workspacesActivated || 0 },
    { label: "Projetos criados", value: metrics.projectsCreated || 0 },
    { label: "Sites publicados", value: metrics.projectsPublished || 0 },
    { label: "Assinaturas pagas", value: metrics.paidSubscriptions || 0, detail: "Somente contratos financeiros reais" },
  ];
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-extrabold tracking-[-.03em]">Visão geral</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667487]">Aquisição, ativação e saúde operacional da plataforma. Valores comerciais dos clientes não são tratados como receita da SOBE.</p></div>
        <AdminPeriod current={days} path="/admin" />
      </div>
      <MetricStrip items={primary} />

      <section className="mt-8 rounded-2xl border border-[#dfe6ee] bg-white p-6">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold">Funil de crescimento</h2><p className="mt-1 text-sm text-[#667487]">Conversão entre as etapas da própria SOBE.</p></div><Link href={`/admin/acquisition?days=${days}`} className="focus-ring rounded-xl px-3 py-2 text-sm font-bold text-[#0054fc] hover:bg-[#eaf3ff]">Detalhar aquisição →</Link></div>
        <GrowthFunnel steps={(funnel || []) as FunnelStep[]} />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold">Operação da base</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#dfe6ee] bg-white">
          <dl className="grid sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Usuários", metrics.usersTotal || 0], ["Espaços de trabalho", metrics.workspacesTotal || 0], ["Negócios", metrics.projectsTotal || 0],
              ["Sites publicados", metrics.publishedTotal || 0], ["Espaços de trabalho inativos", healthCount("inactive")], ["Publicados sem tráfego", healthCount("published_no_traffic")],
              ["Tráfego sem oportunidade", healthCount("traffic_no_opportunity")], ["Usuários ativos no período", metrics.recentUsers || 0],
            ].map(([label, value]) => <div key={String(label)} className="border-b border-[#e7edf3] p-5 lg:border-r"><dt className="text-sm text-[#667487]">{label}</dt><dd className="mt-2 text-2xl font-extrabold tabular-nums">{value}</dd></div>)}
          </dl>
        </div>
      </section>
    </div>
  );
}
