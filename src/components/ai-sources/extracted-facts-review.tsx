"use client";

import { CheckCheck, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExtractedFactCard } from "@/components/ai-sources/extracted-fact-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessSourceFact } from "@/types";

export function ExtractedFactsReview({ sourceIds, projectId }: { sourceIds: string[]; projectId?: string }) {
  const [facts, setFacts] = useState<BusinessSourceFact[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    if (!sourceIds.length) { setFacts([]); return; }
    setLoading(true);
    try {
      const results = await Promise.all(sourceIds.map(async (id) => {
        const response = await fetch(`/api/ai/sources/${id}/facts`);
        const payload = await response.json() as { data?: BusinessSourceFact[] };
        return payload.data || [];
      }));
      const nextFacts = results.flat();
      setFacts(nextFacts);
      setSelected((current) => new Set(nextFacts.filter((fact) => fact.verificationStatus === "verified" && !fact.appliedAt && (current.size === 0 || current.has(fact.id))).map((fact) => fact.id)));
    } finally { setLoading(false); }
  }, [sourceIds]);
  useEffect(() => { void load(); }, [load]);
  const counts = useMemo(() => ({
    review: facts.filter((fact) => fact.verificationStatus === "needs_confirmation").length,
    verified: facts.filter((fact) => fact.verificationStatus === "verified").length,
    applied: facts.filter((fact) => Boolean(fact.appliedAt)).length,
    rejected: facts.filter((fact) => fact.verificationStatus === "rejected").length,
  }), [facts]);
  async function review(fact: BusinessSourceFact, input: { value?: unknown; status: BusinessSourceFact["verificationStatus"] }) {
    const response = await fetch(`/api/ai/sources/${fact.sourceId}/facts/${fact.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error("Não foi possível revisar o fato.");
    await load();
  }
  async function confirmReliable() {
    await Promise.all(facts.filter((fact) => fact.verificationStatus === "needs_confirmation" && (fact.confidence || 0) >= 0.85 && fact.evidenceExcerpt).map((fact) => review(fact, { status: "verified" })));
  }
  async function apply() {
    if (!projectId) return;
    const factIds = facts.filter((fact) => selected.has(fact.id) && fact.verificationStatus === "verified" && !fact.appliedAt).map((fact) => fact.id);
    if (!factIds.length) { setMessage("Nenhum fato confirmado está pendente de aplicação."); return; }
    const response = await fetch("/api/ai/sources/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, factIds }) });
    const payload = await response.json().catch(() => ({})) as { data?: { applied?: number; skipped?: number }; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || "Não foi possível aplicar os fatos.");
    setMessage(`${payload.data?.applied || 0} fatos aplicados; ${payload.data?.skipped || 0} ignorados.`);
    await load();
  }
  if (loading) return <div className="mt-4 flex items-center gap-2 text-xs text-primary"><Loader2 className="animate-spin" />Carregando evidências</div>;
  if (!facts.length) return null;
  const categories = [...new Set(facts.filter((fact) => fact.verificationStatus === "verified" && !fact.appliedAt).map((fact) => fact.type))];
  return <section className="mt-5"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">Fatos extraídos para revisão</h3><p className="text-xs text-muted-foreground">Nada é confirmado ou publicado automaticamente.</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="secondary">{counts.review} para revisar</Badge><Badge variant="secondary">{counts.verified} verificados</Badge><Badge variant="secondary">{counts.applied} aplicados</Badge><Badge variant="secondary">{counts.rejected} rejeitados</Badge></div>{projectId && categories.length ? <div className="mt-3 flex flex-wrap gap-2"><span className="text-xs font-bold">Selecionar categoria:</span>{categories.map((category) => { const ids = facts.filter((fact) => fact.type === category && fact.verificationStatus === "verified" && !fact.appliedAt).map((fact) => fact.id); const active = ids.every((id) => selected.has(id)); return <Button key={category} size="sm" variant="ghost" onClick={() => setSelected((current) => { const next = new Set(current); ids.forEach((id) => active ? next.delete(id) : next.add(id)); return next; })}>{category} ({ids.length})</Button>; })}</div> : null}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={() => void confirmReliable()}><CheckCheck data-icon="inline-start" />Confirmar confiáveis</Button>{projectId ? <Button size="sm" disabled={!selected.size} onClick={() => void apply()}>Aplicar selecionados ({selected.size})</Button> : null}</div></div>{!projectId ? <Alert><AlertTitle>Aplicação disponível após criar o projeto</AlertTitle><AlertDescription>Concluir criação para aplicar estes dados.</AlertDescription></Alert> : null}{message ? <p className="mb-3 text-sm font-semibold text-primary">{message}</p> : null}<div className="grid gap-3">{facts.map((fact) => <ExtractedFactCard key={fact.id} fact={fact} selected={selected.has(fact.id)} onSelectedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(fact.id); else next.delete(fact.id); return next; })} onReview={(input) => review(fact, input)} />)}</div></section>;
}
