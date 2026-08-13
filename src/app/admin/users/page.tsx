import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const p = await searchParams,
    page = Math.max(1, Number(p.page) || 1);
  const { data, count } = await new PlatformAdminRepository(
    createServiceClient()!,
  ).users(page, p.q || "");
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Usuários</h1>
      <form className="mt-5">
        <input
          name="q"
          defaultValue={p.q}
          placeholder="Nome, e-mail ou UUID"
          className="min-h-12 w-full max-w-md rounded-xl border bg-white px-4"
        />
      </form>
      <div className="mt-5 overflow-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Usuário</th>
              <th>Email</th>
              <th>Cadastro</th>
              <th>Último acesso</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((u) => (
              <tr key={u.id} className="border-b">
                <td className="p-4 font-bold">
                  <Link href={`/admin/users/${u.id}`}>
                    {u.full_name || u.id}
                  </Link>
                </td>
                <td>{u.email}</td>
                <td>{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                <td>
                  {u.last_seen_at
                    ? new Date(u.last_seen_at).toLocaleString("pt-BR")
                    : "—"}
                </td>
                <td>{u.account_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} count={count || 0} query={p.q} />
    </div>
  );
}
function Pagination({
  page,
  count,
  query,
}: {
  page: number;
  count: number;
  query?: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-3 text-sm">
      <span>{count} usuários</span>
      {page > 1 && (
        <Link
          className="font-bold"
          href={`?page=${page - 1}&q=${encodeURIComponent(query || "")}`}
        >
          ← Anterior
        </Link>
      )}
      {page * 25 < count && (
        <Link
          className="font-bold"
          href={`?page=${page + 1}&q=${encodeURIComponent(query || "")}`}
        >
          Próxima →
        </Link>
      )}
    </div>
  );
}
