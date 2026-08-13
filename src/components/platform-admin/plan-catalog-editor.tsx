"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

interface EntitlementInput {
  feature_key: string;
  enabled: boolean;
  limit_value: number | null;
}

interface PlanInput {
  plan_key: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_active: boolean;
  display_price: number | null;
  currency: string | null;
  plan_entitlements: EntitlementInput[];
}

export function PlanCatalogEditor({ plan }: { plan: PlanInput }) {
  const router = useRouter();
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || "");
  const [isPublic, setIsPublic] = useState(plan.is_public);
  const [isActive, setIsActive] = useState(plan.is_active);
  const [price, setPrice] = useState(
    plan.display_price == null ? "" : String(plan.display_price),
  );
  const [reason, setReason] = useState("");
  const [entitlements, setEntitlements] = useState(plan.plan_entitlements);
  const [status, setStatus] = useState("");

  function updateEntitlement(
    featureKey: string,
    patch: Partial<EntitlementInput>,
  ) {
    setEntitlements((current) =>
      current.map((item) =>
        item.feature_key === featureKey ? { ...item, ...patch } : item,
      ),
    );
  }

  async function save() {
    setStatus("Salvando…");
    const response = await fetch(
      `/api/admin/plans/${encodeURIComponent(plan.plan_key)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          isPublic,
          isActive,
          displayPrice: price === "" ? null : Number(price),
          entitlements: entitlements.map((item) => ({
            featureKey: item.feature_key,
            enabled: item.enabled,
            limit: item.limit_value,
          })),
          reason,
        }),
      },
    );
    const payload = await response.json();
    setStatus(
      response.ok
        ? "Plano atualizado. O resolver já usa a nova configuração."
        : payload.error?.message || "Não foi possível atualizar o plano.",
    );
    if (response.ok) router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            {plan.plan_key}
          </p>
          <h2 className="text-xl font-extrabold">{plan.name}</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">
          {plan.currency || "BRL"}
        </span>
      </div>
      <div className="mt-5 grid gap-4">
        <div>
          <Label>Nome</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div>
          <Label>Preço de exibição opcional</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-5 text-sm font-semibold">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
            />
            Público
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            Ativo
          </label>
        </div>
        <div>
          <h3 className="font-extrabold">Recursos e limites</h3>
          <div className="mt-3 max-h-[28rem] space-y-2 overflow-auto pr-1">
            {entitlements.map((item) => (
              <div
                key={item.feature_key}
                className="grid grid-cols-[1fr_5rem] items-center gap-3 rounded-xl border p-3"
              >
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(event) =>
                      updateEntitlement(item.feature_key, {
                        enabled: event.target.checked,
                      })
                    }
                  />
                  <span className="break-all">{item.feature_key}</span>
                </label>
                <Input
                  aria-label={`Limite de ${item.feature_key}`}
                  className="min-h-9"
                  type="number"
                  min="0"
                  value={item.limit_value ?? ""}
                  placeholder="∞"
                  onChange={(event) =>
                    updateEntitlement(item.feature_key, {
                      limit_value:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label>Motivo obrigatório</Label>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ajuste do catálogo comercial"
          />
        </div>
        <Button disabled={reason.trim().length < 5} onClick={() => void save()}>
          Salvar plano
        </Button>
        {status && (
          <p className="text-sm" aria-live="polite">
            {status}
          </p>
        )}
      </div>
    </section>
  );
}
