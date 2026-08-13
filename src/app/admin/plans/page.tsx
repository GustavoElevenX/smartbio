import { PlanCatalogEditor } from "@/components/platform-admin/plan-catalog-editor";
import { createServiceClient } from "@/lib/supabase/server";

export default async function Page() {
  const { data } = await createServiceClient()!
    .from("plan_catalog")
    .select(
      "plan_key,name,description,is_public,is_active,display_price,currency,plan_entitlements(feature_key,enabled,limit_value)",
    )
    .order("sort_order");
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Planos</h1>
      <p className="mt-2 text-[#706f78]">
        Catálogo interno independente do gateway de pagamentos. Alterações são
        aplicadas pelo resolver de entitlements sem deploy.
      </p>
      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {(data || []).map((plan) => (
          <PlanCatalogEditor key={plan.plan_key} plan={plan} />
        ))}
      </div>
    </div>
  );
}
