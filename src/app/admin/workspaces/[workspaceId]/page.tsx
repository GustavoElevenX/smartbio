import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveWorkspaceEntitlements } from "@/server/entitlements/entitlement-resolver";
import { WorkspaceAdminActions } from "@/components/platform-admin/workspace-admin-actions";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const db = createServiceClient()!;
  const [
    { data: workspace },
    { data: members },
    { data: projects },
    { data: overrides },
    { data: audit },
    entitlements,
    metrics,
  ] = await Promise.all([
    db
      .from("workspaces")
      .select("id,name,slug,owner_id,account_status,created_at,updated_at")
      .eq("id", workspaceId)
      .maybeSingle(),
    db
      .from("workspace_members")
      .select("user_id,role,profiles(full_name,email)")
      .eq("workspace_id", workspaceId),
    db
      .from("projects")
      .select("id,name,slug,status,updated_at")
      .eq("workspace_id", workspaceId),
    db
      .from("workspace_entitlement_overrides")
      .select(
        "id,feature_key,enabled_override,limit_override,expires_at,revoked_at,reason",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    db
      .from("platform_admin_audit_log")
      .select("id,action,reason,created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
    resolveWorkspaceEntitlements(db, workspaceId),
    new PlatformAdminRepository(db).workspaceDetail(workspaceId),
  ]);
  if (!workspace) notFound();
  return (
    <div>
      <Link href="/admin/workspaces" className="text-sm font-bold">
        ← Workspaces
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{workspace.name}</h1>
      <p className="mt-2 text-gray-600">
        {workspace.slug} · {workspace.account_status} · plano{" "}
        {entitlements.plan.name} ({entitlements.plan.source})
      </p>
      <div className="mt-6">
        <WorkspaceAdminActions
          workspaceId={workspaceId}
          accountStatus={workspace.account_status}
        />
      </div>
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <h2 className="font-extrabold">Uso e resultado · 30 dias</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Páginas" value={metrics.pages} />
          <Metric
            label="Ativações"
            value={`${metrics.activeActivations} ativas · ${metrics.activations} total`}
          />
          <Metric label="Oportunidades" value={metrics.opportunities30d} />
          <Metric label="Conversões" value={metrics.conversions30d} />
          <Metric
            label="Valor marcado como convertido"
            value={new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(metrics.confirmedValue30d || 0)}
          />
          <Metric
            label="Última atividade"
            value={
              metrics.lastActivityAt
                ? new Date(metrics.lastActivityAt).toLocaleString("pt-BR")
                : "—"
            }
          />
        </div>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Entitlements e uso</h2>
          <div className="mt-4 space-y-2 text-sm">
            {Object.entries(entitlements.features).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span>{key}</span>
                <strong>
                  {value.enabled
                    ? value.limit == null
                      ? "ativo"
                      : `${value.used || 0}/${value.limit}`
                    : "bloqueado"}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Usuários</h2>
          <div className="mt-4 space-y-2">
            {(members || []).map((m, index) => {
              const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return (
                <div key={index} className="text-sm">
                  <Link
                    href={`/admin/users/${m.user_id}`}
                    className="font-bold"
                  >
                    {p?.full_name || p?.email}
                  </Link>{" "}
                  · {m.role}
                </div>
              );
            })}
          </div>
          <h2 className="mt-6 font-extrabold">Negócios</h2>
          <div className="mt-4 space-y-2">
            {(projects || []).map((p) => (
              <div key={p.id} className="text-sm">
                <Link href={`/admin/projects/${p.id}`} className="font-bold">
                  {p.name}
                </Link>{" "}
                · {p.status}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Overrides</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(overrides || []).map((o) => (
              <div key={o.id}>
                {o.feature_key}:{" "}
                {o.enabled_override === null ? "—" : String(o.enabled_override)}{" "}
                / {o.limit_override ?? "—"} ·{" "}
                {o.revoked_at ? "revogado" : "ativo"}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Auditoria</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(audit || []).map((a) => (
              <div key={a.id}>
                {a.action} · {a.reason || "—"} ·{" "}
                {new Date(a.created_at).toLocaleString("pt-BR")}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <strong className="mt-1 block">{value}</strong>
    </div>
  );
}
