import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import { adminValueLabel } from "@/lib/admin-labels";

interface WorkspaceHealth {
  workspace_id: string;
  last_activity_at: string | null;
  projects: number;
  published_projects: number;
  sessions_30d: number;
  opportunities_30d: number;
  conversions_30d: number;
  health_state: string;
}

const healthLabels: Record<string, string> = {
  inactive: "Inativo",
  not_activated: "Sem negócio",
  published_no_traffic: "Publicado sem tráfego",
  traffic_no_opportunity: "Tráfego sem oportunidade",
  generating_opportunities: "Gerando oportunidades",
  confirming_conversions: "Confirmando conversões",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const p = await searchParams;
  const page = Math.max(1, Number(p.page) || 1);
  const repository = new PlatformAdminRepository(createServiceClient()!);
  const [{ data, count }, healthResult] = await Promise.all([
    repository.workspaces(page),
    repository.health(30),
  ]);
  const health = new Map(
    ((healthResult.data || []) as WorkspaceHealth[]).map((item) => [
      item.workspace_id,
      item,
    ]),
  );
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Espaços de trabalho</h1>
      <p className="mt-2 text-sm text-gray-600">
        Saúde calculada no servidor para os últimos 30 dias.
      </p>
      <div className="mt-5 overflow-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Espaço de trabalho</th>
              <th>Plano</th>
              <th>Origem</th>
              <th>Negócios</th>
              <th>Publicados</th>
              <th>Oportunidades em 30 dias</th>
              <th>Conversões em 30 dias</th>
              <th>Último uso</th>
              <th>Saúde</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((workspace) => {
              const assignment = Array.isArray(
                workspace.workspace_plan_assignments,
              )
                ? workspace.workspace_plan_assignments[0]
                : workspace.workspace_plan_assignments;
              const state = health.get(workspace.id);
              return (
                <tr key={workspace.id} className="border-b">
                  <td className="p-4 font-bold">
                    <Link href={`/admin/workspaces/${workspace.id}`}>
                      {workspace.name}
                    </Link>
                  </td>
                  <td>{adminValueLabel(assignment?.plan_key)}</td>
                  <td>{adminValueLabel(assignment?.source)}</td>
                  <td>{state?.projects ?? 0}</td>
                  <td>{state?.published_projects ?? 0}</td>
                  <td>{state?.opportunities_30d ?? 0}</td>
                  <td>{state?.conversions_30d ?? 0}</td>
                  <td>
                    {state?.last_activity_at
                      ? new Date(state.last_activity_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td>{healthLabels[state?.health_state || ""] || "—"}</td>
                  <td>{adminValueLabel(workspace.account_status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pages page={page} count={count || 0} />
    </div>
  );
}

function Pages({ page, count }: { page: number; count: number }) {
  return (
    <div className="mt-4 flex gap-3 text-sm">
      <span>{count} espaços de trabalho</span>
      {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
      {page * 25 < count && <Link href={`?page=${page + 1}`}>Próxima →</Link>}
    </div>
  );
}
