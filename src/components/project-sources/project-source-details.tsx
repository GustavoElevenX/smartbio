"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BusinessSource } from "@/types";

export function ProjectSourceDetails({ projectId, source, onChanged }: { projectId: string; source: BusinessSource; onChanged: () => void }) {
  async function action(kind: "reprocess" | "delete") {
    if (kind === "delete" && !window.confirm("Excluir esta fonte? Dados já aplicados serão protegidos.")) return;
    const response = await fetch(`/api/projects/${projectId}/sources/${source.id}${kind === "reprocess" ? "/reprocess" : ""}`, { method: kind === "reprocess" ? "POST" : "DELETE" });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }; throw new Error(payload.error?.message || "Não foi possível alterar a fonte."); }
    onChanged();
  }
  return <Card><CardHeader><CardTitle>{source.name}</CardTitle><CardDescription>{source.sourceUrl || source.mimeType || "Material privado"}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{source.status}</dd></div><div><dt className="text-muted-foreground">Fatos extraídos</dt><dd className="font-semibold">{Number(source.extractedData.factCount || 0)}</dd></div></dl>{source.processingError ? <p className="text-sm text-destructive">{source.processingError}</p> : null}<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void action("reprocess")}><RefreshCw data-icon="inline-start" />Reprocessar</Button><Button variant="danger" onClick={() => void action("delete")}><Trash2 data-icon="inline-start" />Excluir fonte</Button></div></CardContent></Card>;
}
