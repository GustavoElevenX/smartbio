"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pause, Play, Square } from "lucide-react";
import type { ConversionActivation, ActivationPerformance as Performance } from "@/features/activations/activation.types";
import { publishedActivationSnapshotSchema } from "@/features/activations/published-activation.schema";
import { ActivationStatus } from "./activation-status";
import { ActivationPerformance } from "./activation-performance";
import { ActivationClaims, type ClaimRow } from "./activation-claims";
import { ActivationRedemptions, type RedemptionRow } from "./activation-redemptions";
import { ActivationValidatorSettings } from "./activation-validator-settings";

type Action = "publish" | "pause" | "resume" | "end" | "duplicate";

export function ActivationDetail({ activation, projectSlug, performance, claims = [], redemptions = [], validators = [] }: {
  activation: ConversionActivation; projectSlug?: string; performance: Performance; claims?: ClaimRow[];
  redemptions?: RedemptionRow[]; validators?: Array<{ id: string; name: string; location?: string; lastUsedAt?: string; active: boolean }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "claims" | "redemptions" | "settings">("overview");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const published = publishedActivationSnapshotSchema.safeParse(activation.publishedSnapshot);
  const publishedSurface = published.success && published.data.snapshotVersion === 2 ? published.data.dynamicSurface : undefined;
  const needsRepublish = Boolean(activation.publishedAt && activation.publishedVersion !== activation.version);
  const exclusiveUrl = published.success && publishedSurface && projectSlug ? `/${projectSlug}/c/${published.data.activationKey}` : undefined;

  async function action(value: Action) {
    if (value === "publish" && !window.confirm("Revise o título, as condições, o destino e o período. Publicar esta versão agora?")) return;
    setBusy(value);
    setError("");
    try {
      const response = await fetch(`/api/projects/${activation.projectId}/activations/${activation.id}/${value}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: value === "publish" ? JSON.stringify({ confirmed: true, reviewedVersion: activation.version }) : undefined,
      });
      const payload = await response.json() as { data?: { activation?: { id: string } }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível atualizar a campanha.");
      if (value === "duplicate" && payload.data?.activation?.id) router.push(`/app/projects/${activation.projectId}/activations/${payload.data.activation.id}`);
      else router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a campanha."); }
    finally { setBusy(""); }
  }

  return <div>
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-4xl font-extrabold tracking-[-.045em]">{activation.name}</h1><ActivationStatus status={activation.status}/></div>
        <p className="mt-3 text-[#6e6e78]">{activation.description || activation.message || "Configure, publique e acompanhe o resultado real desta ativação."}</p>
        {needsRepublish ? <p className="mt-2 text-sm font-bold text-amber-700">Há alterações salvas que ainda não foram publicadas.</p> : null}
        {exclusiveUrl ? <p className="mt-3 text-sm"><strong>Link da campanha:</strong> <Link className="break-all text-[#0054fc] underline" href={exclusiveUrl}>{exclusiveUrl}</Link></p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => action("duplicate")} disabled={Boolean(busy)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedde5] bg-white px-4 text-sm font-bold"><Copy size={16}/>Duplicar</button>
        {activation.status === "draft" || needsRepublish ? <button type="button" onClick={() => action("publish")} disabled={Boolean(busy)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white"><Play size={16}/>{needsRepublish ? "Publicar nova versão" : "Ativar"}</button> : null}
        {activation.status === "paused" ? <button type="button" onClick={() => action("resume")} disabled={Boolean(busy)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white"><Play size={16}/>Retomar</button> : null}
        {activation.status === "active" || activation.status === "scheduled" ? <><button type="button" onClick={() => action("pause")} disabled={Boolean(busy)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0054fc] bg-white px-4 text-sm font-bold text-[#0054fc]"><Pause size={16}/>Pausar</button><button type="button" onClick={() => action("end")} disabled={Boolean(busy)} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-700"><Square size={15}/>Encerrar</button></> : null}
        {busy ? <Loader2 className="animate-spin self-center" size={18}/> : null}
      </div>
    </header>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
    <section className="mt-7 grid gap-3 rounded-2xl border border-[#e4e3ea] bg-white p-4 sm:grid-cols-3">
      <div><span className="text-xs font-bold text-[#81818a]">Período</span><strong className="mt-1 block text-sm">{activation.startsAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: activation.timezone }).format(new Date(activation.startsAt)) : "Agora"} — {activation.endsAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: activation.timezone }).format(new Date(activation.endsAt)) : "sem término"}</strong></div>
      <div><span className="text-xs font-bold text-[#81818a]">Público</span><strong className="mt-1 block text-sm">{activation.eligibility.customerRule?.replaceAll("_", " ") || "Qualquer pessoa"}</strong></div>
      <div><span className="text-xs font-bold text-[#81818a]">Oferta</span><strong className="mt-1 block text-sm">{activation.offers[0]?.label || "Sem desconto"}</strong></div>
    </section>
    <nav className="mt-6 flex gap-1 overflow-auto border-b border-[#dddae5]" aria-label="Detalhes da ativação">{([ ["overview", "Visão geral"], ["claims", "Claims"], ["redemptions", "Resgates"], ["settings", "Configuração"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`min-h-12 border-b-2 px-4 text-sm font-bold ${tab === value ? "border-[#0054fc] text-[#0054fc]" : "border-transparent text-[#6f6f79]"}`}>{label}</button>)}</nav>
    <div className="mt-6">{tab === "overview" ? <ActivationPerformance performance={performance}/> : tab === "claims" ? <ActivationClaims claims={claims}/> : tab === "redemptions" ? <ActivationRedemptions redemptions={redemptions}/> : <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-[#e4e3ea] bg-white p-5"><h3 className="font-extrabold">Configuração publicada</h3><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-[#7b7b84]">Onde aparece</dt><dd className="mt-1 font-bold">{activation.placements.map((item) => item.placementType.replaceAll("_", " ")).join(", ") || "Nenhum posicionamento"}</dd></div><div><dt className="text-[#7b7b84]">Resultado</dt><dd className="mt-1 font-bold">{String(activation.settings.conversionPolicy || "manual_conversion").replaceAll("_", " ")}</dd></div><div><dt className="text-[#7b7b84]">Versão</dt><dd className="mt-1 font-bold">{activation.publishedVersion || "Ainda não publicada"}</dd></div></dl></section><ActivationValidatorSettings projectId={activation.projectId} validators={validators}/></div>}</div>
  </div>;
}
