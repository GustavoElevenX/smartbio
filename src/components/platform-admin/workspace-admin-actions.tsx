"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

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
            <h2 className="font-extrabold">Acesso ao workspace</h2>
            <p className="mt-1 text-sm text-gray-600">
              Status atual: <strong>{accountStatus}</strong>. Suspender bloqueia
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
              ? "Suspender workspace"
              : "Reativar workspace"}
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
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </Select>
          </div>
          <div>
            <Label>Motivo</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Cliente beta"
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
        <h2 className="font-extrabold">Novo override</h2>
        <div className="mt-4 grid gap-3">
          <div>
            <Label>Recurso</Label>
            <Input
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
            />
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
            Criar override
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
