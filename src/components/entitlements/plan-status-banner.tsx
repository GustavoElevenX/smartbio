"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getTrialDaysRemaining, SOBE_TRIAL } from "@/lib/sobe-pro";
import type { WorkspaceEntitlements } from "@/server/entitlements/entitlement-types";

export function PlanStatusBanner() {
  const [data, setData] = useState<WorkspaceEntitlements>();
  useEffect(() => {
    void fetch("/api/workspace/entitlements")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => setData(payload?.data));
  }, []);
  if (!data || data.plan.key !== SOBE_TRIAL.key) return null;

  const expired = data.plan.status === "expired";
  const started = Boolean(data.plan.endsAt);
  const days = getTrialDaysRemaining(data.plan.endsAt);
  return (
    <aside className={`mb-6 flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${expired ? "bg-[#07172f] text-white" : "border border-[#c9d8ee] bg-[#eaf3ff] text-[#07172f]"}`}>
      <div>
        <strong className="text-sm">
          {expired ? "Seu período de teste terminou." : started ? `${days} ${days === 1 ? "dia restante" : "dias restantes"} no seu teste.` : "Seus 7 dias começam quando a primeira estrutura ficar pronta."}
        </strong>
        <p className={`mt-1 text-xs leading-5 ${expired ? "text-white/70" : "text-[#536178]"}`}>
          {expired ? "Sua estrutura continua salva. Assine o SOBE Pro para colocá-la novamente no ar." : "Teste sem cartão, com 1 página publicada e 10 ações com IA."}
        </p>
      </div>
      <Link href="/app/settings/billing" className={`focus-ring inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${expired ? "bg-white text-[#07172f]" : "bg-[#0054fc] text-white"}`}>
        {expired ? "Assinar SOBE Pro" : "Ver meu plano"} <ArrowRight size={15} />
      </Link>
    </aside>
  );
}
