"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { adminFeatureLabel, adminValueLabel } from "@/lib/admin-labels";

export function WorkspaceAdminActions({
  workspaceId,
  accountStatus,
}: {
  workspaceId: string;
  accountStatus: "active" | "suspended";
}) {
  const router = useRouter();
  const [planKey, setPlanKey] = useState("free");
  const [reason, setReason] = useState("");
  const [feature, setFeature] = useState("active_activations");
  const [limit, setLimit] = useState("5");
  const [status, setStatus] = useState("");
  async function mutate(url: string, body: unknown, method = "POST") {
    setStatus("Aplicando…");
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setStatus(
      response.ok ? "Alteração aplicada." : payload.error?.message || "Falha.",
    );
    if (response.ok) router.refresh();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
        <h2 className="font-extrabold">Acesso ao espaço de trabalho</h2>
            <p className="mt-1 text-sm text-gray-600">
              Situação atual: <strong>{adminValueLabel(accountStatus)}</strong>. Suspender bloqueia
              o acesso sem apagar projetos ou dados.
            </p>
          </div>
          <Button
            variant={accountStatus === "active" ? "danger" : "secondary"}
            disabled={reason.trim().length < 5}
            onClick={() =>
              void mutate(
                `/api/admin/workspaces/${workspaceId}`,
                {
                  accountStatus:
                    accountStatus === "active" ? "suspended" : "active",
                  reason,
                },
                "PATCH",
              )
            }
          >
            {accountStatus === "active"
              ? "Suspender espaço de trabalho"
              : "Reativar espaço de trabalho"}
          </Button>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-extrabold">Plano manual</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <Label>Plano</Label>
            <Select
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
            >
              <option value="trial">Período de teste</option>
              <option value="pro">SOBE Pro</option>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cliente em validação"
            />
          </div>
          <div className="flex gap-2">
            <Button
              disabled={reason.trim().length < 5}
              onClick={() =>
                void mutate(`/api/admin/workspaces/${workspaceId}/plan`, {
                  planKey,
                  status: "active",
                  reason,
                })
              }
            >
              Aplicar
            </Button>
            <Button
              variant="danger"
              disabled={reason.trim().length < 5}
              onClick={() =>
                void mutate(`/api/admin/workspaces/${workspaceId}/plan`, {
                  planKey,
                  status: "suspended",
                  reason,
                })
              }
            >
              Suspender plano
            </Button>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-extrabold">Nova exceção de recurso</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <Label>Recurso</Label>
            <Select value={feature} onChange={(e) => setFeature(e.target.value)}>
              {["active_activations", "presence_pages", "team_members", "ai_generations_month", "media_storage_mb"].map((key) => <option key={key} value={key}>{adminFeatureLabel(key)}</option>)}
            </Select>
          </div>
          <div>
            <Label>Limite</Label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </div>
          <Button
            disabled={reason.trim().length < 5}
            onClick={() =>
              void mutate(`/api/admin/workspaces/${workspaceId}/overrides`, {
                featureKey: feature,
                enabled: true,
                limit: Number(limit),
                reason,
              })
            }
          >
            Criar exceção
          </Button>
        </div>
      </section>
      {status && (
        <p className="text-sm lg:col-span-2" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
