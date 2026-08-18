import Link from "next/link";
import { EmptyAdmin } from "@/components/platform-admin/admin-metrics";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminValueLabel } from "@/lib/admin-labels";

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const { data, count } = await new PlatformAdminRepository(createServiceClient()!).pages(page);
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-.03em]">Páginas</h1>
      <p className="mt-2 text-sm text-[#667487]">Visão transversal das páginas criadas pelos negócios da plataforma.</p>
      <div className="mt-6 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white">
        <table className="w-full min-w-[92rem] text-left text-sm">
          <thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Página</th><th>Negócio</th><th>Espaço de trabalho</th><th>Proprietário</th><th>Caminho</th><th>Inicial</th><th>Ativa</th><th>Situação</th><th>Visualizações em 30 dias</th><th>Cliques de ação em 30 dias</th><th>Oportunidades em 30 dias</th><th>Atualização</th></tr></thead>
          <tbody>{(data || []).map((item) => { const project = item.project; const workspace = Array.isArray(project?.workspaces) ? project?.workspaces[0] : project?.workspaces; return <tr key={item.id} className="border-b"><td className="p-4 font-bold"><Link className="text-[#0054fc]" href={`/admin/projects/${project?.id}`}>{item.name}</Link></td><td>{project?.name}</td><td><Link href={`/admin/workspaces/${project?.workspace_id}`}>{workspace?.name || project?.workspace_id}</Link></td><td><Link href={`/admin/users/${workspace?.owner_id}`}>{workspace?.owner_id || "—"}</Link></td><td>{item.path}</td><td>{item.is_home ? "Sim" : "Não"}</td><td>{item.is_active ? "Sim" : "Não"}</td><td>{adminValueLabel(project?.status)}</td><td>{item.views30d}</td><td>{item.ctaClicks30d}</td><td>{item.opportunities30d}</td><td>{new Date(item.updated_at).toLocaleString("pt-BR")}</td></tr>; })}</tbody>
        </table>
        {!data?.length ? <EmptyAdmin>Nenhuma página criada ainda.</EmptyAdmin> : null}
      </div>
      <div className="mt-4 flex items-center gap-3 text-sm"><span>{count || 0} páginas</span>{page > 1 ? <Link className="font-bold" href={`?page=${page - 1}`}>← Anterior</Link> : null}{page * 25 < (count || 0) ? <Link className="font-bold" href={`?page=${page + 1}`}>Próxima →</Link> : null}</div>
    </div>
  );
}
