"use client";

import Link from "next/link";
import { ArrowRight, Check, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { getTrialDaysRemaining, SOBE_PRO, SOBE_TRIAL } from "@/lib/sobe-pro";
import type { WorkspaceEntitlements } from "@/server/entitlements/entitlement-types";

const included = [
  "1 negócio e até 5 páginas publicadas",
  "Até 3 membros na equipe",
  "50 ações com IA por mês",
  "Jornadas, oportunidades e analytics",
  "Orçamentos, agendamentos e multiunidades",
  "Identidade visual a partir da logo",
] as const;

export function BillingSettingsReal() {
  const [data, setData] = useState<WorkspaceEntitlements>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void fetch("/api/workspace/entitlements")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setData((await response.json()).data);
      })
      .catch(() => setFailed(true));
  }, []);

  const isTrial = data?.plan.key === SOBE_TRIAL.key;
  const isExpired = data?.plan.status === "expired";
  const trialStarted = isTrial && Boolean(data.plan.endsAt);
  const daysRemaining = getTrialDaysRemaining(data?.plan.endsAt);
  const ai = data?.features.ai_generations_month;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-extrabold tracking-[-.03em]">Plano e cobrança</h1>
      <p className="mt-2 text-[#536178]">Veja seu período de teste, uso de IA e o que está incluído.</p>
      {failed ? <div role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Não foi possível carregar seu plano. Atualize a página para tentar novamente.</div> : null}

      <section className="mt-7 overflow-hidden rounded-2xl bg-[#07172f] text-white shadow-[0_24px_64px_rgba(7,23,47,.18)]">
        <div className="sobe-gradient-rule" />
        <div className="grid gap-10 p-6 sm:p-8 lg:grid-cols-[.9fr_1.1fr] lg:p-10">
          <div>
            <span className="inline-flex rounded-full bg-[#0054fc] px-3 py-1.5 text-xs font-bold">{data?.plan.name || "Carregando plano…"}</span>
            <h2 className="mt-6 text-3xl font-extrabold tracking-[-.03em]">
              {isExpired ? "Seu período de teste terminou." : trialStarted ? `${daysRemaining} ${daysRemaining === 1 ? "dia restante" : "dias restantes"} no teste.` : isTrial ? "Seu teste começa com a primeira estrutura." : `${SOBE_PRO.name} ativo`}
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">
              {isExpired ? "Sua estrutura continua salva. Assine o SOBE Pro para colocá-la novamente no ar." : isTrial && !trialStarted ? "Conclua o onboarding e gere sua primeira estrutura. Só então os 7 dias começam a contar." : isTrial ? "Teste completo, sem cartão. Durante o período, a marca SOBE permanece nas páginas." : `${SOBE_PRO.formattedPrice}/mês · ${SOBE_PRO.launchLabel}`}
            </p>
            {ai?.limit != null ? <div className="mt-7 flex items-center gap-3 text-sm"><Clock3 className="size-5 text-[#02e5cd]" aria-hidden="true" /><span><strong>{ai.used || 0} de {ai.limit}</strong> ações com IA utilizadas</span></div> : null}
            {isTrial ? <Link href="/pricing" className="focus-ring mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-bold text-[#07172f] transition hover:bg-[#e9fffc]">Assinar {SOBE_PRO.name} <ArrowRight size={17} /></Link> : null}
          </div>
          <div className="border-t border-white/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <h3 className="font-extrabold">Tudo no {SOBE_PRO.name}</h3>
            <ul className="mt-5 grid gap-3">
              {included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-white/80"><Check className="mt-1 size-4 shrink-0 text-[#02e5cd]" aria-hidden="true" />{item}</li>)}
            </ul>
          </div>
        </div>
      </section>
      {isTrial ? <p className="mt-5 text-sm leading-6 text-[#667487]">Mantemos sua estrutura salva por {SOBE_TRIAL.retentionDays} dias após o fim do teste para você poder reativá-la com a assinatura.</p> : null}
    </div>
  );
}
