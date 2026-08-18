import { ArrowRight, Star } from "lucide-react";
import type { ConversionGoal, JourneyStep } from "@/types";

export function ConversionGoalCard({ goal, step }: { goal: ConversionGoal; step?: JourneyStep }) {
  return <article className="rounded-[20px] border border-[#e2e0e8] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-extrabold tracking-[-.02em]">{goal.name}</h3>{goal.isPrimary ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf3ff] px-2 py-1 text-[10px] font-bold text-[#0054fc]"><Star size={11} /> Principal</span> : null}</div><p className="mt-2 text-sm leading-6 text-[#74727c]">{goal.description || "Sem descrição."}</p></div><span className={`size-2 rounded-full ${goal.isActive ? "bg-emerald-500" : "bg-zinc-300"}`} /></div><div className="mt-5 flex items-center gap-2 rounded-[14px] bg-[#f6f5f8] px-3 py-2.5 text-xs"><span className="font-semibold text-[#777580]">Começa em</span><ArrowRight size={13} /><strong>{step?.title || "Etapa não encontrada"}</strong></div></article>;
}
