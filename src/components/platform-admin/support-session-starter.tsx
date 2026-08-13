"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function SupportSessionStarter() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  async function start() {
    setStatus("Iniciando…");
    const response = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        projectId: projectId || undefined,
        reason,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error?.message || "Falha ao iniciar suporte.");
      return;
    }
    router.push(projectId ? `/app/projects/${projectId}` : "/app");
    router.refresh();
  }
  return (
    <section className="mt-6 rounded-2xl border bg-white p-6">
      <h2 className="font-extrabold">Iniciar suporte</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <Label>Workspace UUID</Label>
          <Input
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          />
        </div>
        <div>
          <Label>Projeto UUID (opcional)</Label>
          <Input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </div>
        <div>
          <Label>Motivo obrigatório</Label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cliente solicitou ajuste"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => void start()}>Iniciar por 60 minutos</Button>
        {status && <span className="text-sm">{status}</span>}
      </div>
    </section>
  );
}
