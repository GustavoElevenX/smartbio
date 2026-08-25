import { AlertCircle, CheckCircle2, CircleDashed } from "lucide-react";
import type { DataRequirement } from "@/types";

export function SetupRequirements({ requirements }: { requirements: DataRequirement[] }) {
  if (!requirements.length) return <p className="text-xs text-[#85848e]">Depois de entender o negócio, a Sobe mostra aqui o que já sabe e o que ainda precisa.</p>;
  return (
    <div className="grid gap-2">
      {requirements.slice(0, 6).map((item) => {
        const verified = item.status === "verified";
        const Icon = verified ? CheckCircle2 : item.severity === "blocking" ? AlertCircle : CircleDashed;
        return <div key={item.key} className="flex items-start gap-2 rounded-xl border border-[#ebe9f0] bg-white p-3">
          <Icon size={15} className={verified ? "mt-0.5 text-[#1b9a70]" : item.severity === "blocking" ? "mt-0.5 text-[#ee775f]" : "mt-0.5 text-[#8b8994]"} />
          <div className="min-w-0"><strong className="block truncate text-xs text-[#484850]">{item.label}</strong><span className="text-[10px] text-[#8b8994]">{verified ? "Confirmado" : item.severity === "blocking" ? "Falta informar" : "Pode completar depois"}</span></div>
        </div>;
      })}
      {requirements.length > 6 ? <p className="text-center text-[11px] font-semibold text-[#777581]">Mais {requirements.length - 6} itens para revisar depois</p> : null}
    </div>
  );
}
