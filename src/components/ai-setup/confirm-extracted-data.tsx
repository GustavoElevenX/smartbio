import { BadgeCheck, Sparkles } from "lucide-react";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";

function humanizeReason(reason: string) {
  return reason
    .replace(/qualificação comercial/gi, "entender o pedido do cliente")
    .replace(/qualificação/gi, "entender o pedido")
    .replace(/roteamento/gi, "encontrar uma unidade");
}

export function ConfirmExtractedData({ session }: { session: AISetupSession }) {
  const profile = session.extractedProfile;
  if (!profile) return null;
  const actions = [...new Set(session.visitorActions.map((action) => action.label))];
  return (
    <div className="rounded-[20px] border border-[#eaf3ff] bg-[#f7fbff] p-5">
      <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-[#0054fc]"><Sparkles size={14} /> Leitura do negócio</span>
      <h3 className="mt-3 text-lg font-extrabold tracking-[-.025em]">Entendi os caminhos comerciais principais.</h3>
      <p className="mt-2 text-sm leading-6 text-[#676571]">{profile.analysisMetadata?.reasons.map(humanizeReason).join(" ")}</p>
      <div className="mt-4 flex flex-wrap gap-2">{actions.map((label) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#0054fc]"><BadgeCheck size={13} /> {label}</span>)}</div>
    </div>
  );
}
