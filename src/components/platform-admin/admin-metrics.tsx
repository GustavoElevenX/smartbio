import Link from "next/link";

export function AdminPeriod({ current, path }: { current: number; path: string }) {
  return (
    <nav className="flex rounded-xl border border-[#d7e1ec] bg-white p-1" aria-label="Período">
      {[7, 30, 90].map((days) => <Link key={days} href={`${path}?days=${days}`} aria-current={current === days ? "page" : undefined} className={`focus-ring rounded-lg px-3 py-2 text-xs font-bold ${current === days ? "bg-[#07172f] text-white" : "text-[#536178] hover:bg-[#eef4fa]"}`}>{days} dias</Link>)}
    </nav>
  );
}

export function MetricStrip({ items }: { items: Array<{ label: string; value: string | number; detail?: string }> }) {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-[#dfe6ee] bg-white">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => <div key={item.label} className="min-h-32 border-b border-[#e7edf3] p-5 sm:border-r xl:[&:nth-child(4n)]:border-r-0"><p className="text-sm font-semibold text-[#667487]">{item.label}</p><strong className="mt-4 block text-3xl tracking-[-.03em] tabular-nums">{item.value}</strong>{item.detail ? <p className="mt-2 text-xs text-[#7a8797]">{item.detail}</p> : null}</div>)}
      </div>
    </div>
  );
}

export interface FunnelStep { key: string; label: string; total: number; conversion?: number | null }

const funnelStepLabels: Record<string, string> = {
  visitor: "Visitantes",
  cta: "Botões de ação",
  account: "Cadastro",
  onboarding: "Configuração concluída",
  project: "Negócio criado",
  published: "Publicado",
  paid: "Pagante",
};

export function GrowthFunnel({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return <p className="mt-5 text-sm text-[#667487]">O funil aparecerá quando os primeiros eventos forem registrados.</p>;
  const max = Math.max(1, ...steps.map((step) => Number(step.total)));
  return (
    <ol className="mt-6 grid gap-1">
      {steps.map((step, index) => <li key={step.key} className="grid items-center gap-3 sm:grid-cols-[150px_1fr_120px]"><span className="text-sm font-semibold">{funnelStepLabels[step.key] || "Etapa"}</span><div className="h-9 overflow-hidden rounded-lg bg-[#eef4fa]"><div className="flex h-full min-w-10 items-center bg-[#0054fc] px-3 text-xs font-extrabold text-white transition-[width]" style={{ width: `${Math.max(8, Number(step.total) * 100 / max)}%` }}>{step.total}</div></div><span className="text-right text-xs font-semibold text-[#667487]">{index === 0 || step.conversion == null ? "Base" : `${step.conversion}% da etapa anterior`}</span></li>)}
    </ol>
  );
}

export function EmptyAdmin({ children }: { children: React.ReactNode }) {
  return <div className="p-8 text-center text-sm text-[#667487]">{children}</div>;
}
