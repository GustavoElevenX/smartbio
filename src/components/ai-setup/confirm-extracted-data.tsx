import { BadgeCheck, Sparkles } from "lucide-react";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { capabilityLabels } from "@/lib/constants";
import type { CapabilityKey } from "@/types";

export function ConfirmExtractedData({ session }: { session: AISetupSession }) {
  const profile = session.extractedProfile;
  if (!profile) return null;
  const capabilities = [...new Set(session.missingRequirements.map((item) => item.capability).filter((item): item is CapabilityKey => item !== "brand" && item !== "project"))];
  return (
    <div className="rounded-[20px] border border-[#eaf3ff] bg-[#f7fbff] p-5">
      <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-[#0054fc]"><Sparkles size={14} /> Leitura do negócio</span>
      <h3 className="mt-3 text-lg font-extrabold tracking-[-.025em]">Entendi os caminhos comerciais principais.</h3>
      <p className="mt-2 text-sm leading-6 text-[#676571]">{profile.analysisMetadata?.reasons.join(" ")}</p>
      <div className="mt-4 flex flex-wrap gap-2">{capabilities.map((key) => <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#0054fc]"><BadgeCheck size={13} /> {capabilityLabels[key]}</span>)}</div>
      {session.usedFallback ? <p className="mt-4 text-[11px] leading-5 text-[#777482]">Análise local ativa. Ao configurar a OpenAI, o mesmo fluxo passa a enriquecer a leitura e as perguntas automaticamente.</p> : null}
    </div>
  );
}
