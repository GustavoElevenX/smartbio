import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await searchParams,
    page = Math.max(1, Number(p.page) || 1),
    db = createServiceClient()!;
  const { data, count } = await db
    .from("platform_admin_audit_log")
    .select(
      "id,admin_user_id,admin_role,workspace_id,project_id,action,object_type,object_id,reason,created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Auditoria</h1>
      <div className="mt-6 overflow-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Ação</th>
              <th>Admin</th>
              <th>Workspace</th>
              <th>Motivo</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-4 font-bold">{r.action}</td>
                <td>{r.admin_user_id}</td>
                <td>{r.workspace_id || "—"}</td>
                <td>{r.reason || "—"}</td>
                <td>{new Date(r.created_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex gap-3 text-sm">
        <span>{count || 0} registros</span>
        {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
        {page * 50 < (count || 0) && (
          <Link href={`?page=${page + 1}`}>Próxima →</Link>
        )}
      </div>
    </div>
  );
}
