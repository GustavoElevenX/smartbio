import { PlanCatalogEditor } from "@/components/platform-admin/plan-catalog-editor";
import { createServiceClient } from "@/lib/supabase/server";
import { adminValueLabel } from "@/lib/admin-labels";

export default async function Page() {
  const database = createServiceClient()!;
  const [{ data }, { data: subscriptions }, { data: assignments }] = await Promise.all([
    database.from("plan_catalog").select("plan_key,name,description,is_public,is_active,display_price,currency,plan_entitlements(feature_key,enabled,limit_value)").order("sort_order"),
    database.from("subscriptions").select("id,workspace_id,plan_key,status,provider,current_period_end,cancel_at_period_end,workspaces(name)").order("created_at", { ascending: false }).limit(50),
    database.from("workspace_plan_assignments").select("workspace_id,plan_key,source,status"),
  ]);
  const activeContracts = (subscriptions || []).filter((item) => ["active", "trialing"].includes(item.status)).length;
  const administrativeAccess = (assignments || []).filter((item) => item.source !== "billing" && item.status === "active").length;
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Planos e cobrança</h1>
      <p className="mt-2 text-[#706f78]">
        Acesso ao produto e contrato financeiro são conceitos separados. Isso evita tratar concessões administrativas ou períodos de teste como receita.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-[#dfe6ee] bg-white p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#667487]">Contratos financeiros ativos</p><strong className="mt-2 block text-3xl tabular-nums">{activeContracts}</strong><p className="mt-2 text-sm text-[#667487]">Somente registros reais de assinatura.</p></section>
        <section className="rounded-2xl border border-[#dfe6ee] bg-white p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#667487]">Acessos não financeiros ativos</p><strong className="mt-2 block text-3xl tabular-nums">{administrativeAccess}</strong><p className="mt-2 text-sm text-[#667487]">Sistema, período de teste ou concessão administrativa.</p></section>
      </div>
      <h2 className="mt-8 text-xl font-extrabold">Catálogo e limites</h2>
      <p className="mt-2 text-sm text-[#667487]">As permissões aplicam estas regras sem depender do sistema de cobrança.</p>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {(data || []).map((plan) => (
          <PlanCatalogEditor key={plan.plan_key} plan={plan} />
        ))}
      </div>
      <section className="mt-8 overflow-auto rounded-2xl border border-[#dfe6ee] bg-white">
        <div className="border-b border-[#e7edf3] p-5"><h2 className="font-extrabold">Contratos recentes</h2><p className="mt-1 text-sm text-[#667487]">Apenas assinaturas persistidas pelo fluxo de cobrança.</p></div>
        <table className="w-full min-w-[55rem] text-left text-sm"><thead><tr className="border-b bg-[#f7f8fa] text-[#536178]"><th className="p-4">Espaço de trabalho</th><th>Plano</th><th>Situação</th><th>Provedor</th><th>Fim do ciclo</th><th>Cancelamento agendado</th></tr></thead><tbody>{(subscriptions || []).map((subscription) => { const workspace = Array.isArray(subscription.workspaces) ? subscription.workspaces[0] : subscription.workspaces; return <tr key={subscription.id} className="border-b"><td className="p-4 font-bold">{workspace?.name || subscription.workspace_id}</td><td>{adminValueLabel(subscription.plan_key)}</td><td>{adminValueLabel(subscription.status)}</td><td>{subscription.provider || "—"}</td><td>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("pt-BR") : "—"}</td><td>{subscription.cancel_at_period_end ? "Sim" : "Não"}</td></tr>; })}</tbody></table>
        {!subscriptions?.length ? <p className="p-6 text-center text-sm text-[#667487]">Nenhum contrato financeiro registrado.</p> : null}
      </section>
    </div>
  );
}
