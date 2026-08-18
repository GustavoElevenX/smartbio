import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminValueLabel } from "@/lib/admin-labels";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await searchParams,
    page = Math.max(1, Number(p.page) || 1);
  const { data, count } = await new PlatformAdminRepository(
    createServiceClient()!,
  ).projects(page);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Negócios</h1>
      <div className="mt-5 overflow-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Negócio</th>
              <th>Espaço de trabalho</th>
              <th>Situação</th>
              <th>Atualização</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-4 font-bold">
                  <Link href={`/admin/projects/${p.id}`}>{p.name}</Link>
                </td>
                <td>
                  <Link href={`/admin/workspaces/${p.workspace_id}`}>
                    {p.workspace_id}
                  </Link>
                </td>
                <td>{adminValueLabel(p.status)}</td>
                <td>{new Date(p.updated_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <span>{count || 0} negócios</span>
        {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
        {page * 25 < (count || 0) && (
          <Link href={`?page=${page + 1}`}>Próxima →</Link>
        )}
      </div>
    </div>
  );
}
