"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { useState } from "react";
import type { PublicActivation } from "@/features/activations/activation.types";

type Claim = { id: string; code: string; benefitLabel: string; expiresAt?: string };

export function ActivationClaimDialog({ activation, projectId, sessionId, pageId, onClose, onSuccess, onContinueWithoutBenefit }: {
  activation: PublicActivation;
  projectId: string;
  sessionId: string;
  pageId: string;
  onClose(): void;
  onSuccess(claim: Claim): void;
  onContinueWithoutBenefit(): void;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [claim, setClaim] = useState<Claim>();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/public/activations/${activation.id}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, sessionId, phone, presencePageId: pageId, conversionGoalId: activation.conversionGoalId }) });
      const payload = await response.json() as { data?: { eligible?: boolean; claim?: Claim; message?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.eligible || !payload.data.claim) throw new Error(payload.data?.message || payload.error?.message || "Não foi possível validar.");
      setClaim(payload.data.claim);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível validar."); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[70] grid items-end bg-black/45 p-0 backdrop-blur-sm md:items-center md:p-5" role="dialog" aria-modal="true" aria-labelledby="activation-claim-title"><button aria-label="Fechar" className="absolute inset-0" onClick={onClose} /><section className="relative mx-auto w-full max-w-lg rounded-t-[28px] bg-white p-6 shadow-2xl md:rounded-[28px]"><button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-black/5"><X size={18} /></button>{claim ? <div className="py-6 text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-600" /><h2 id="activation-claim-title" className="mt-4 text-2xl font-black">Seu benefício foi liberado.</h2><p className="mt-4 text-lg font-extrabold">{claim.benefitLabel}</p><div className="mx-auto mt-4 max-w-xs rounded-2xl bg-[#f0edff] p-5"><span className="text-xs font-bold uppercase tracking-[.12em] text-[#6653d8]">Código</span><strong className="mt-2 block font-mono text-3xl tracking-[.18em]">{claim.code}</strong></div><button type="button" onClick={() => onSuccess(claim)} className="mt-6 min-h-12 w-full rounded-xl bg-[var(--presence-primary)] px-5 font-extrabold text-white">Agora continue seu pedido</button></div> : <form onSubmit={submit}><p className="text-sm font-bold text-[var(--presence-primary)]">{activation.offer?.label || "Benefício"}</p><h2 id="activation-claim-title" className="mt-2 pr-10 text-2xl font-black">Para validar seu benefício, informe seu WhatsApp.</h2><p className="mt-3 text-sm leading-6 text-[#686873]">Usaremos seu WhatsApp para validar este benefício e continuar seu atendimento.</p><label className="mt-6 block"><span className="text-sm font-bold">WhatsApp</span><input autoFocus inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(98) 99999-9999" className="mt-2 min-h-12 w-full rounded-xl border border-black/15 px-4 outline-none focus:border-[var(--presence-primary)]" /></label>{error ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}<button type="button" onClick={onContinueWithoutBenefit} className="mt-2 block underline">Continuar sem benefício</button></div> : null}<button disabled={busy} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--presence-primary)] px-5 font-extrabold text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={18} /> : null}Verificar meu benefício</button></form>}</section></div>;
}
