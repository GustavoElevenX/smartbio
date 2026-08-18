import Link from "next/link";
import { AlertTriangle, Archive, CalendarClock, Database, FilePenLine, Plus, Power, type LucideIcon } from "lucide-react";
import type { ConversionActivation } from "@/features/activations/activation.types";
import { ActivationEmptyState } from "./activation-empty-state";
import { ActivationList } from "./activation-list";

export function ActivationsPage({ projectId, activations }: { projectId: string; activations: ConversionActivation[] }) {
  const counts = { active: activations.filter((a) => a.status === "active").length, scheduled: activations.filter((a) => a.status === "scheduled").length, draft: activations.filter((a) => a.status === "draft").length, ended: activations.filter((a) => ["ended", "archived"].includes(a.status)).length };
  const summaries: Array<[string, number, LucideIcon, string]> = [
    ["Ativas", counts.active, Power, "text-emerald-700 bg-emerald-50"],
    ["Agendadas", counts.scheduled, CalendarClock, "text-amber-700 bg-amber-50"],
    ["Rascunhos", counts.draft, FilePenLine, "text-violet-700 bg-violet-50"],
    ["Encerradas", counts.ended, Archive, "text-neutral-700 bg-neutral-100"],
  ];
  return <div>
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-bold text-[#0054fc]">Ativações</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-.045em]">O momento comercial do seu negócio, em movimento.</h1><p className="mt-3 text-[#6e6e78]">Planeje, ative, converta, meça e aprenda — sem reconstruir sua presença.</p></div><div className="flex flex-wrap gap-3"><Link href={`/app/projects/${projectId}/activations/eligibility`} className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#9fc3ff] bg-white px-5 font-bold text-[#514a71]"><Database size={18} />Base de clientes</Link><Link href={`/app/projects/${projectId}/activations/new`} className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0054fc] px-5 font-bold text-white"><Plus size={18} />Nova ativação</Link></div></header>
    {activations.length ? <><section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaries.map(([label, count, Icon, style]) => <div key={label} className="flex items-center gap-4 rounded-2xl border border-[#e5e4ec] bg-white p-5"><span className={`grid size-11 place-items-center rounded-xl ${style}`}><Icon size={20} /></span><div><p className="text-sm text-[#72727c]">{label}</p><strong className="text-2xl">{count}</strong></div></div>)}</section><div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#ffd2cb] bg-[#fff6f4] p-4 text-sm text-[#9a382b]"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><strong>Conflitos são resolvidos por prioridade.</strong><p className="mt-1 text-[#a85d53]">Uma barra, um hero e um CTA flutuante principal podem aparecer por vez.</p></div></div><div className="mt-6"><ActivationList activations={activations} /></div></> : <div className="mt-8"><ActivationEmptyState projectId={projectId} /></div>}
  </div>;
}
