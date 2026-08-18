import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveWorkspaceEntitlements } from "@/server/entitlements/entitlement-resolver";
import { WorkspaceAdminActions } from "@/components/platform-admin/workspace-admin-actions";
import { PlatformAdminRepository } from "@/server/platform-admin/platform-admin-repository";
import {
  adminActionLabel,
  adminFeatureLabel,
  adminValueLabel,
} from "@/lib/admin-labels";

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const db = createServiceClient()!;
  const repository = new PlatformAdminRepository(db);
  const [
    { data: workspace },
    { data: members },
    { data: projects },
    { data: overrides },
    { data: audit },
    { data: assignment },
    { data: subscription },
    { data: planHistory },
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
      .select("id,name,slug,status,updated_at,presence_pages(id,page_key,name,path,is_home,is_active,updated_at)")
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
    db.from("workspace_plan_assignments").select("plan_key,source,status,starts_at,ends_at,reason").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("subscriptions").select("plan_key,status,provider,external_subscription_id,current_period_end,cancel_at_period_end,created_at").eq("workspace_id", workspaceId).maybeSingle(),
    db.from("workspace_plan_history").select("id,previous_plan_key,new_plan_key,source,reason,created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    resolveWorkspaceEntitlements(db, workspaceId),
    repository.workspaceDetail(workspaceId),
  ]);
  if (!workspace) notFound();
  const projectIds = (projects || []).map((project) => project.id);
  const [ownerAttribution, engagement] = await Promise.all([
    db.from("platform_signup_attribution").select("first_touch,signup_touch,linked_at").eq("user_id", workspace.owner_id).maybeSingle(),
    repository.workspaceEngagement(workspaceId, projectIds),
  ]);
  const attribution = ownerAttribution.data?.first_touch as Record<string, string> | undefined;
  return (
    <div>
      <Link href="/admin/workspaces" className="text-sm font-bold">
        ← Espaços de trabalho
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{workspace.name}</h1>
      <p className="mt-2 text-gray-600">
        {workspace.slug} · {adminValueLabel(workspace.account_status)} · plano{" "}
        {entitlements.plan.name} ({adminValueLabel(entitlements.plan.source)})
      </p>
      <div className="mt-6">
        <WorkspaceAdminActions
          workspaceId={workspaceId}
          accountStatus={workspace.account_status}
        />
      </div>
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <h2 className="font-extrabold">Uso e resultado</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Páginas" value={metrics.pages} />
          <Metric label="Visualizações · 7 / 30 dias" value={`${engagement.views7} / ${engagement.views30}`} />
          <Metric label="Sessões · 7 / 30 dias" value={`${engagement.sessions7} / ${engagement.sessions30}`} />
          <Metric
            label="Ativações"
            value={`${metrics.activeActivations} ativas · ${metrics.activations} total`}
          />
          <Metric label="Oportunidades · 7 / 30 dias" value={`${engagement.opportunities7} / ${metrics.opportunities30d}`} />
          <Metric label="Conversões · 30 dias" value={metrics.conversions30d} />
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
          <h2 className="font-extrabold">Aquisição do proprietário</h2>
          {attribution ? <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Field label="Primeiro contato">{adminValueLabel(attribution.source || "direct")} · {adminValueLabel(attribution.medium)}</Field><Field label="Campanha">{attribution.campaign || "—"}</Field><Field label="Conteúdo">{attribution.content || "—"}</Field><Field label="Vinculado em">{ownerAttribution.data?.linked_at ? new Date(ownerAttribution.data.linked_at).toLocaleString("pt-BR") : "—"}</Field></dl> : <p className="mt-4 text-sm text-gray-600">Sem atribuição própria vinculada.</p>}
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Plano e cobrança</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><Field label="Acesso concedido">{adminValueLabel(assignment?.plan_key || entitlements.plan.key)} · {adminValueLabel(assignment?.source || entitlements.plan.source)}</Field><Field label="Situação do acesso">{adminValueLabel(assignment?.status)}</Field><Field label="Contrato financeiro">{subscription ? `${adminValueLabel(subscription.plan_key)} · ${adminValueLabel(subscription.status)}` : "Sem assinatura"}</Field><Field label="Provedor / ciclo">{subscription?.provider || "—"} · {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR") : "—"}</Field></dl>
          <p className="mt-4 text-xs leading-5 text-gray-500">O acesso autorizado e o contrato financeiro são exibidos separadamente. Um plano administrativo não é contado como receita.</p>
        </section>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Recursos e uso</h2>
          <div className="mt-4 space-y-2 text-sm">
            {Object.entries(entitlements.features).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span>{adminFeatureLabel(key)}</span>
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
                  · {adminValueLabel(m.role)}
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
                · {adminValueLabel(p.status)}
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-extrabold">Páginas</h2>
          <div className="mt-4 space-y-3">
            {(projects || []).flatMap((project) => (project.presence_pages || []).map((page) => ({ page, project }))).map(({ page, project }) => {
              const publicHref = page.is_home ? `/${project.slug}` : `/${project.slug}/p/${page.page_key}`;
              return <div key={page.id} className="flex items-center justify-between gap-3 text-sm"><div><strong>{page.name}</strong><p className="text-xs text-gray-500">{page.path} · {page.is_active ? "ativa" : "inativa"}</p></div>{project.status === "published" && page.is_active ? <Link href={publicHref} target="_blank" className="font-bold text-[#0054fc]">Abrir</Link> : null}</div>;
            })}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Exceções de recursos</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(overrides || []).map((o) => (
              <div key={o.id}>
                {adminFeatureLabel(o.feature_key)}:{" "}
                {o.enabled_override === null ? "—" : o.enabled_override ? "Sim" : "Não"}{" "}
                / {o.limit_override ?? "—"} ·{" "}
                {o.revoked_at ? "revogado" : "ativo"}
              </div>
            ))}
          </div>
          <h2 className="mt-6 font-extrabold">Histórico de plano</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(planHistory || []).map((item) => <div key={item.id}>{adminValueLabel(item.previous_plan_key || "inicial")} → <strong>{adminValueLabel(item.new_plan_key)}</strong> · {adminValueLabel(item.source)} · {new Date(item.created_at).toLocaleString("pt-BR")}</div>)}
            {!planHistory?.length ? <p className="text-gray-500">Nenhuma alteração registrada.</p> : null}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="font-extrabold">Auditoria</h2>
          <div className="mt-4 space-y-2 text-sm">
            {(audit || []).map((a) => (
              <div key={a.id}>
                {adminActionLabel(a.action)} · {a.reason || "—"} ·{" "}
                {new Date(a.created_at).toLocaleString("pt-BR")}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 break-words font-semibold text-[#24364b]">{children || "—"}</dd></div>;
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
