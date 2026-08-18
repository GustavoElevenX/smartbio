import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminActionLabel, adminTrackingElementLabel, adminValueLabel } from "@/lib/admin-labels";

interface Profile { id: string; full_name?: string; email?: string; created_at: string; last_seen_at?: string; last_sign_in_at?: string; account_status: string }
interface Attribution { firstTouch?: Record<string, string>; signupTouch?: Record<string, string>; linkedAt?: string; visitorId?: string; firstSeenAt?: string; firstLanding?: string; firstReferrer?: string }
interface Workspace { id: string; name: string; role: string; plan?: string; planSource?: string; planStatus?: string; subscription?: { status?: string; provider?: string; externalId?: string; periodEnd?: string; cancelAtPeriodEnd?: boolean } }
interface PageRow { id: string; pageKey: string; name: string; projectId: string; project: string; slug: string; path: string; home: boolean; active: boolean; published: boolean; updatedAt: string }
interface Usage { workspaces?: number; projects?: number; pages?: number; published?: number; sessions?: number; opportunities?: number }
interface Timeline { name: string; createdAt: string; path?: string; elementKey?: string; metadata?: Record<string, unknown> }

const eventLabels: Record<string, string> = {
  marketing_page_viewed: "Visitou a página de entrada", marketing_section_viewed: "Visualizou uma seção", marketing_cta_clicked: "Clicou em um botão de ação", pricing_viewed: "Visualizou os preços", register_viewed: "Visualizou o cadastro", register_started: "Iniciou o cadastro", register_submitted: "Enviou o cadastro",
  account_created: "Criou a conta", email_confirmed: "Confirmou o e-mail", onboarding_started: "Iniciou a configuração",
  onboarding_completed: "Concluiu a configuração", project_created: "Criou um negócio", presence_page_created: "Criou uma página",
  project_published: "Publicou", subscription_started: "Iniciou uma assinatura", subscription_cancelled: "Cancelou a assinatura",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-[#758396]">{label}</dt><dd className="mt-1 break-words text-sm text-[#24364b]">{children || "—"}</dd></div>; }

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const database = createServiceClient()!;
  const [result, auth] = await Promise.all([new PlatformAdminRepository(database).user360(userId), database.auth.admin.getUserById(userId)]);
  if (!result || !result.profile) notFound();
  const profile = result.profile as Profile;
  const attribution = (result.attribution || {}) as Attribution;
  const workspaces = (result.workspaces || []) as Workspace[];
  const pages = (result.pages || []) as PageRow[];
  const usage = (result.usage || {}) as Usage;
  const timeline = (result.timeline || []) as Timeline[];
  const history = (result.planHistory || []) as Array<{ id: string; previous_plan_key?: string; new_plan_key: string; source: string; reason?: string; created_at: string }>;
  return (
    <div>
      <Link href="/admin/users" className="text-sm font-bold text-[#0054fc]">← Usuários</Link>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-extrabold tracking-[-.03em]">{profile.full_name || profile.email || userId}</h1><p className="mt-2 text-sm text-[#667487]">Visão completa do cliente · aquisição, plano, uso e conteúdo criado.</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${profile.account_status === "active" ? "bg-[#e7f8f1] text-[#137252]" : "bg-red-50 text-red-700"}`}>{profile.account_status === "active" ? "Conta ativa" : "Conta suspensa"}</span></div>

      <div className="mt-7 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[#dfe6ee] bg-white p-6"><h2 className="text-lg font-extrabold">Identidade</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Nome">{profile.full_name}</Field><Field label="E-mail">{profile.email}</Field><Field label="Identificador">{profile.id}</Field><Field label="Conta criada">{new Date(profile.created_at).toLocaleString("pt-BR")}</Field><Field label="E-mail confirmado">{auth.data.user?.email_confirmed_at ? new Date(auth.data.user.email_confirmed_at).toLocaleString("pt-BR") : "Pendente"}</Field><Field label="Último acesso">{profile.last_seen_at ? new Date(profile.last_seen_at).toLocaleString("pt-BR") : "—"}</Field></dl></section>
        <section className="rounded-2xl border border-[#dfe6ee] bg-white p-6"><h2 className="text-lg font-extrabold">Aquisição</h2>{attribution.firstTouch ? <dl className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Primeiro contato">{adminValueLabel(attribution.firstTouch.source || "direct")} · {adminValueLabel(attribution.firstTouch.medium)}</Field><Field label="Campanha / conteúdo">{attribution.firstTouch.campaign || "—"} · {attribution.firstTouch.content || "—"}</Field><Field label="Página de entrada inicial">{attribution.firstLanding || attribution.firstTouch.landingPath}</Field><Field label="Site de origem inicial">{adminValueLabel(attribution.firstReferrer || "direct")}</Field><Field label="Sessão do cadastro">{adminValueLabel(attribution.signupTouch?.source || "direct")} · {attribution.signupTouch?.campaign || "—"}</Field><Field label="Primeira visita">{attribution.firstSeenAt ? new Date(attribution.firstSeenAt).toLocaleString("pt-BR") : "—"}</Field></dl> : <p className="mt-5 text-sm leading-6 text-[#667487]">Esta conta não possui atribuição própria, normalmente porque foi criada antes da implantação do rastreamento ou por um fluxo administrativo.</p>}</section>
      </div>

      <section className="mt-6 rounded-2xl border border-[#dfe6ee] bg-white p-6"><h2 className="text-lg font-extrabold">Plano e cobrança</h2><div className="mt-5 grid gap-4">{workspaces.map((workspace) => <article key={workspace.id} className="grid gap-4 rounded-xl bg-[#f7f8fa] p-4 md:grid-cols-[1.2fr_repeat(4,1fr)]"><div><Link href={`/admin/workspaces/${workspace.id}`} className="font-bold text-[#0054fc]">{workspace.name}</Link><p className="mt-1 text-xs text-[#667487]">{adminValueLabel(workspace.role)}</p></div><Field label="Plano">{adminValueLabel(workspace.plan)} · {adminValueLabel(workspace.planSource)}</Field><Field label="Autorização">{adminValueLabel(workspace.planStatus)}</Field><Field label="Contrato financeiro">{workspace.subscription?.status ? adminValueLabel(workspace.subscription.status) : "Sem contrato"}</Field><Field label="Provedor / ciclo">{workspace.subscription?.provider || "—"} · {workspace.subscription?.periodEnd ? new Date(workspace.subscription.periodEnd).toLocaleDateString("pt-BR") : "—"}</Field></article>)}</div>{history.length ? <div className="mt-5 border-t border-[#e7edf3] pt-4"><h3 className="text-sm font-bold">Histórico de plano</h3><div className="mt-3 space-y-2 text-sm text-[#536178]">{history.map((item) => <p key={item.id}>{new Date(item.created_at).toLocaleString("pt-BR")} · {adminValueLabel(item.previous_plan_key || "inicial")} → <strong>{adminValueLabel(item.new_plan_key)}</strong> · {adminValueLabel(item.source)}{item.reason ? ` · ${item.reason}` : ""}</p>)}</div></div> : null}</section>

      <section className="mt-6"><h2 className="text-lg font-extrabold">Uso nos últimos 90 dias</h2><div className="mt-4 grid overflow-hidden rounded-2xl border border-[#dfe6ee] bg-white sm:grid-cols-3 lg:grid-cols-6">{[["Espaços de trabalho", usage.workspaces], ["Negócios", usage.projects], ["Páginas", usage.pages], ["Publicados", usage.published], ["Sessões recebidas", usage.sessions], ["Oportunidades", usage.opportunities]].map(([label, value]) => <div key={String(label)} className="border-b border-r border-[#e7edf3] p-5"><p className="text-xs font-semibold text-[#667487]">{label}</p><strong className="mt-2 block text-2xl tabular-nums">{value || 0}</strong></div>)}</div></section>

      <section className="mt-6"><h2 className="text-lg font-extrabold">Conteúdo criado</h2><div className="mt-4 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white"><table className="w-full min-w-[70rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Página</th><th>Negócio</th><th>Caminho</th><th>Inicial</th><th>Ativa</th><th>Publicada</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>{pages.map((page) => <tr key={page.id} className="border-b"><td className="p-4 font-bold">{page.name}</td><td>{page.project}</td><td>{page.path}</td><td>{page.home ? "Sim" : "Não"}</td><td>{page.active ? "Sim" : "Não"}</td><td>{page.published ? "Sim" : "Não"}</td><td>{new Date(page.updatedAt).toLocaleString("pt-BR")}</td><td><div className="flex gap-3"><Link className="font-bold text-[#0054fc]" href={`/admin/projects/${page.projectId}`}>Administrar</Link>{page.published ? <Link className="font-bold text-[#0054fc]" href={`/${page.slug}${page.home ? "" : `/p/${page.pageKey}`}`} target="_blank">Abrir</Link> : null}</div></td></tr>)}</tbody></table>{!pages.length ? <p className="p-6 text-center text-sm text-[#667487]">Nenhuma página criada.</p> : null}</div></section>

      <section className="mt-6 rounded-2xl border border-[#dfe6ee] bg-white p-6"><h2 className="text-lg font-extrabold">Histórico de atividades</h2>{timeline.length ? <ol className="mt-5 space-y-0">{timeline.slice(0, 100).map((event, index) => <li key={`${event.name}:${event.createdAt}:${index}`} className="grid grid-cols-[14px_1fr] gap-3"><span className="relative mt-1.5 size-2 rounded-full bg-[#0054fc] after:absolute after:left-[3px] after:top-2 after:h-full after:w-px after:bg-[#cbd8e6] last:after:hidden"/><div className="pb-5"><strong className="text-sm">{eventLabels[event.name] || adminActionLabel(event.name)}</strong><p className="mt-1 text-xs text-[#667487]">{new Date(event.createdAt).toLocaleString("pt-BR")}{event.elementKey ? ` · ${adminTrackingElementLabel(event.elementKey)}` : ""}{event.path ? ` · ${event.path}` : ""}</p></div></li>)}</ol> : <p className="mt-4 text-sm text-[#667487]">Nenhum evento de aquisição ou ativação vinculado.</p>}</section>

      <section className="mt-6 rounded-2xl border border-[#dfe6ee] bg-[#07172f] p-6 text-white"><h2 className="text-lg font-extrabold">Ações administrativas</h2><p className="mt-2 text-sm text-white/70">Alterações de plano, suspensão e suporte permanecem auditáveis no espaço de trabalho correspondente. Não há acesso assumido de forma silenciosa.</p><div className="mt-4 flex flex-wrap gap-3">{workspaces.map((workspace) => <Link key={workspace.id} href={`/admin/workspaces/${workspace.id}`} className="focus-ring rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#07172f]">Administrar {workspace.name}</Link>)}</div></section>
    </div>
  );
}
