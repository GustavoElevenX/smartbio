import Link from "next/link";
import { AdminPeriod, EmptyAdmin, GrowthFunnel, MetricStrip, type FunnelStep } from "@/components/platform-admin/admin-metrics";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminTrackingElementLabel, adminValueLabel } from "@/lib/admin-labels";

type SourceRow = { source: string; medium: string; campaign: string; visitors: number; cta_clicks: number; signups: number; published: number; paid: number; visitor_to_signup: number | null; signup_to_paid: number | null };
type CtaRow = { element_key: string; utm_content: string; clicks: number; visitors: number; signups: number; signup_rate: number | null };
type Growth = { uniqueVisitors: number; sessions: number; newVisitors: number; returningVisitors: number; ctaClicks: number; accountsCreated: number; workspacesActivated: number; paidSubscriptions: number };

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const query = await searchParams;
  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const database = createServiceClient()!;
  const [data, recent] = await Promise.all([
    new PlatformAdminRepository(database).acquisition(days),
    database.from("platform_signup_attribution").select("user_id,workspace_id,first_touch,signup_touch,linked_at,profiles(full_name,email)").order("linked_at", { ascending: false }).limit(20),
  ]);
  const metrics = (data.overview || {}) as Growth;
  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-extrabold tracking-[-.03em]">Aquisição</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667487]">Origem, conteúdo e botões de ação que levam visitantes da SOBE até cadastro, publicação e assinatura.</p></div>
        <AdminPeriod current={days} path="/admin/acquisition" />
      </div>
      <MetricStrip items={[
        { label: "Visitantes únicos", value: metrics.uniqueVisitors || 0 }, { label: "Sessões", value: metrics.sessions || 0 },
        { label: "Novos visitantes", value: metrics.newVisitors || 0 }, { label: "Retornantes", value: metrics.returningVisitors || 0 },
        { label: "Cliques em botões de ação", value: metrics.ctaClicks || 0 }, { label: "Cadastros", value: metrics.accountsCreated || 0 },
        { label: "Usuários ativados", value: metrics.workspacesActivated || 0 }, { label: "Pagantes", value: metrics.paidSubscriptions || 0 },
      ]} />

      <section className="mt-8 rounded-2xl border border-[#dfe6ee] bg-white p-6"><h2 className="text-xl font-extrabold">Funil principal</h2><GrowthFunnel steps={(data.funnel || []) as FunnelStep[]} /></section>

      <section className="mt-8"><h2 className="text-xl font-extrabold">Origem e campanha</h2><p className="mt-1 text-sm text-[#667487]">Agrupamento pelo primeiro contato do visitante.</p><div className="mt-4 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white"><table className="w-full min-w-[78rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Origem</th><th>Mídia</th><th>Campanha</th><th>Visitantes</th><th>Botões de ação</th><th>Cadastros</th><th>Publicados</th><th>Pagantes</th><th>Visitante → cadastro</th><th>Cadastro → pago</th></tr></thead><tbody>{(data.sources as SourceRow[]).map((row) => <tr key={`${row.source}:${row.medium}:${row.campaign}`} className="border-b"><td className="p-4 font-bold">{adminValueLabel(row.source)}</td><td>{adminValueLabel(row.medium)}</td><td>{row.campaign}</td><td>{row.visitors}</td><td>{row.cta_clicks}</td><td>{row.signups}</td><td>{row.published}</td><td>{row.paid}</td><td>{row.visitor_to_signup == null ? "—" : `${row.visitor_to_signup}%`}</td><td>{row.signup_to_paid == null ? "—" : `${row.signup_to_paid}%`}</td></tr>)}</tbody></table>{!data.sources.length ? <EmptyAdmin>Nenhuma origem registrada no período.</EmptyAdmin> : null}</div></section>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section><h2 className="text-xl font-extrabold">Conteúdo e botões de ação</h2><div className="mt-4 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white"><table className="w-full min-w-[42rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Botão</th><th>Conteúdo</th><th>Cliques</th><th>Visitantes</th><th>Cadastros</th><th>Taxa</th></tr></thead><tbody>{(data.ctas as CtaRow[]).map((row) => <tr key={`${row.element_key}:${row.utm_content}`} className="border-b"><td className="p-4 font-bold">{adminTrackingElementLabel(row.element_key)}</td><td>{adminValueLabel(row.utm_content)}</td><td>{row.clicks}</td><td>{row.visitors}</td><td>{row.signups}</td><td>{row.signup_rate == null ? "—" : `${row.signup_rate}%`}</td></tr>)}</tbody></table>{!data.ctas.length ? <EmptyAdmin>Os cliques nos botões de ação aparecerão aqui.</EmptyAdmin> : null}</div></section>
        <section><h2 className="text-xl font-extrabold">Caminhos de entrada</h2><div className="mt-4 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white"><table className="w-full min-w-[34rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Caminho</th><th>Visualizações</th><th>Visitantes</th><th>Botões de ação</th></tr></thead><tbody>{data.paths.map((row) => <tr key={row.path} className="border-b"><td className="p-4 font-bold">{row.path}</td><td>{row.views}</td><td>{row.visitors}</td><td>{row.clicks}</td></tr>)}</tbody></table></div></section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[.7fr_1.3fr]">
        <section><h2 className="text-xl font-extrabold">Sites de origem</h2><div className="mt-4 rounded-2xl border border-[#dfe6ee] bg-white p-5">{data.referrers.length ? <dl className="space-y-3">{data.referrers.map((row) => <div key={row.referrer} className="flex justify-between gap-4 text-sm"><dt>{adminValueLabel(row.referrer)}</dt><dd className="font-bold tabular-nums">{row.visitors}</dd></div>)}</dl> : <EmptyAdmin>Nenhum site de origem no período.</EmptyAdmin>}</div></section>
        <section><h2 className="text-xl font-extrabold">Cadastros atribuídos</h2><p className="mt-1 text-sm text-[#667487]">O primeiro contato permanece imutável; o contato do cadastro registra a sessão em que a conta foi criada.</p><div className="mt-4 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white"><table className="w-full min-w-[44rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Usuário</th><th>Primeiro contato</th><th>Contato do cadastro</th><th>Vinculado em</th></tr></thead><tbody>{(recent.data || []).map((item) => { const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles; const first = item.first_touch as Record<string, string>; const signup = item.signup_touch as Record<string, string>; return <tr key={item.user_id} className="border-b"><td className="p-4"><Link href={`/admin/users/${item.user_id}`} className="font-bold text-[#0054fc]">{profile?.full_name || profile?.email || item.user_id}</Link></td><td>{adminValueLabel(first?.source || "direct")} · {first?.campaign || "—"}</td><td>{adminValueLabel(signup?.source || "direct")} · {signup?.campaign || "—"}</td><td>{new Date(item.linked_at).toLocaleString("pt-BR")}</td></tr>; })}</tbody></table></div></section>
      </div>
    </div>
  );
}
