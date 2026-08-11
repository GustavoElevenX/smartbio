import { ArrowRight, CircleDot, MousePointerClick, Route, Target } from "lucide-react";
import type { Project } from "@/types";
export function ConversionMap({ project }: { project: Project }) {
  const nodes = [["Entrada", `${project.entryPoints?.filter((item) => item.isActive).length || 0} links`, MousePointerClick], ["Intenção", `${project.conversionGoals?.filter((item) => item.isActive).length || 0} metas`, Target], ["Jornada", `${project.steps.filter((item) => item.isActive).length} etapas`, Route], ["Destino", project.primaryDestination, CircleDot]] as const;
  return <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-center">{nodes.map(([label, value, Icon], index) => <div key={label} className="contents"><div className="rounded-[18px] border border-[#e3e1e9] bg-white p-4"><Icon size={18} className="text-[#6556dc]" /><span className="mt-5 block text-[11px] font-bold uppercase tracking-[.12em] text-[#85838d]">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>{index < nodes.length - 1 ? <ArrowRight className="mx-auto rotate-90 text-[#aaa6b7] lg:rotate-0" size={16} /> : null}</div>)}</div>;
}
