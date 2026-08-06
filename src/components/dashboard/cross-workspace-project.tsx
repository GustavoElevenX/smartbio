"use client";

import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CrossWorkspaceProject({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function switchWorkspace() {
    setBusy(true); setError("");
    const response = await fetch("/api/workspaces/active", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId }) });
    if (!response.ok) { setError("Não foi possível trocar o workspace."); setBusy(false); return; }
    localStorage.removeItem("smartbio-onboarding-state");
    router.push("/app"); router.refresh();
  }
  return <div className="mx-auto grid min-h-[55vh] max-w-xl place-items-center"><Alert><ArrowRightLeft /><AlertTitle>Projeto de outro workspace</AlertTitle><AlertDescription>Este projeto pertence ao workspace <strong>{workspaceName}</strong>. A troca nunca é feita silenciosamente.</AlertDescription><div className="mt-4"><Button disabled={busy} onClick={() => void switchWorkspace()}>{busy ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}Trocar para {workspaceName}</Button></div>{error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}</Alert></div>;
}
