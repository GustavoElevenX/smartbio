import Link from "next/link";
import { EmptyAdmin } from "@/components/platform-admin/admin-metrics";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminValueLabel } from "@/lib/admin-labels";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; plan?: string; paid?: string; published?: string; source?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const { data, count } = await new PlatformAdminRepository(createServiceClient()!).users(page, query.q || "");
  const rows = (data || []).filter((user) =>
    (!query.plan || user.plan === query.plan) &&
    (!query.paid || (query.paid === "yes" ? user.subscriptionStatus === "active" : user.subscriptionStatus !== "active")) &&
    (!query.published || (query.published === "yes" ? user.published : !user.published)) &&
    (!query.source || user.source.toLowerCase().includes(query.source.toLowerCase())),
  );
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-.03em]">Usuários</h1>
      <p className="mt-2 text-sm text-[#667487]">Aquisição, plano e ativação de cada conta.</p>
      <form className="mt-6 grid gap-3 rounded-2xl border border-[#dfe6ee] bg-white p-4 md:grid-cols-2 xl:grid-cols-[2fr_repeat(4,1fr)_auto]">
        <input name="q" defaultValue={query.q} placeholder="Nome, e-mail ou identificador" className="focus-ring min-h-11 rounded-xl border border-[#d7e1ec] px-3 text-sm" />
        <select name="plan" defaultValue={query.plan || ""} className="focus-ring min-h-11 rounded-xl border border-[#d7e1ec] px-3 text-sm"><option value="">Todos os planos</option><option value="trial">Teste</option><option value="pro">SOBE Pro</option></select>
        <select name="paid" defaultValue={query.paid || ""} className="focus-ring min-h-11 rounded-xl border border-[#d7e1ec] px-3 text-sm"><option value="">Pagamento</option><option value="yes">Pagante</option><option value="no">Não pagante</option></select>
        <select name="published" defaultValue={query.published || ""} className="focus-ring min-h-11 rounded-xl border border-[#d7e1ec] px-3 text-sm"><option value="">Publicação</option><option value="yes">Já publicou</option><option value="no">Não publicou</option></select>
        <input name="source" defaultValue={query.source} placeholder="Origem/campanha" className="focus-ring min-h-11 rounded-xl border border-[#d7e1ec] px-3 text-sm" />
        <button className="focus-ring min-h-11 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white hover:bg-[#0048d9]">Filtrar</button>
      </form>
      <div className="mt-5 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white">
        <table className="w-full min-w-[90rem] text-left text-sm">
          <thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Usuário</th><th>E-mail</th><th>Cadastro</th><th>Último acesso</th><th>Plano</th><th>Assinatura</th><th>Origem</th><th>Campanha</th><th>Negócios</th><th>Páginas</th><th>Publicado</th><th>Situação</th></tr></thead>
          <tbody>{rows.map((user) => <tr key={user.id} className="border-b"><td className="p-4 font-bold"><Link href={`/admin/users/${user.id}`} className="text-[#0054fc]">{user.full_name || user.id}</Link></td><td>{user.email}</td><td>{new Date(user.created_at).toLocaleDateString("pt-BR")}</td><td>{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString("pt-BR") : "—"}</td><td>{adminValueLabel(user.plan)}</td><td>{adminValueLabel(user.subscriptionStatus)}</td><td>{adminValueLabel(user.source)}</td><td>{user.campaign}</td><td>{user.projects}</td><td>{user.pages}</td><td>{user.published ? "Sim" : "Não"}</td><td>{adminValueLabel(user.account_status)}</td></tr>)}</tbody>
        </table>
        {!rows.length ? <EmptyAdmin>Nenhum usuário corresponde aos filtros desta página.</EmptyAdmin> : null}
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm"><span>{count || 0} usuários</span>{page > 1 ? <Link className="font-bold" href={`?page=${page - 1}&q=${encodeURIComponent(query.q || "")}`}>← Anterior</Link> : null}{page * 25 < (count || 0) ? <Link className="font-bold" href={`?page=${page + 1}&q=${encodeURIComponent(query.q || "")}`}>Próxima →</Link> : null}</div>
    </div>
  );
}
