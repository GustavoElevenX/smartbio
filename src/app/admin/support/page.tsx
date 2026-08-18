import { createServiceClient } from "@/lib/supabase/server";
import { SupportSessionStarter } from "@/components/platform-admin/support-session-starter";
import { adminValueLabel } from "@/lib/admin-labels";
export default async function Page() {
  const { data } = await createServiceClient()!
    .from("platform_support_sessions")
    .select(
      "id,workspace_id,project_id,reason,status,started_at,expires_at,ended_at",
    )
    .order("started_at", { ascending: false })
    .limit(100);
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Suporte</h1>
      <p className="mt-2 text-[#706f78]">
        Sessões explícitas, com motivo, escopo e expiração máxima de 60 minutos.
      </p>
      <SupportSessionStarter />
      <div className="mt-6 space-y-3">
        {(data || []).map((s) => (
          <div key={s.id} className="rounded-2xl border bg-white p-5">
            <div className="flex justify-between">
              <strong>{s.workspace_id}</strong>
              <span>{adminValueLabel(s.status)}</span>
            </div>
            <p className="mt-2 text-sm">{s.reason}</p>
            <p className="mt-2 text-xs text-[#77747f]">
              Expira em {new Date(s.expires_at).toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
