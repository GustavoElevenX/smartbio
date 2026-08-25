import { Check, CheckCircle2, LoaderCircle } from "lucide-react";

export type GenerationPhase = "idle" | "checking" | "composing" | "saving" | "finalizing" | "ready";

const stages: Array<{ phase: Exclude<GenerationPhase, "idle" | "ready">; label: string }> = [
  { phase: "checking", label: "Conferindo a configuração" },
  { phase: "composing", label: "Montando a jornada e organizando os serviços" },
  { phase: "saving", label: "Salvando a primeira versão" },
  { phase: "finalizing", label: "Preparando a revisão de lançamento" },
];

export function GenerationStatus({ status }: { status: GenerationPhase }) {
  if (status === "idle") return null;
  const activeIndex = status === "ready" ? stages.length : stages.findIndex((stage) => stage.phase === status);
  return <div role="status" aria-live="polite" className="border border-[#c8d9ea] bg-[#f7fbff] p-5 text-sm text-[#07172f]" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}>
    <span className="flex items-center gap-2 font-extrabold">{status === "ready" ? <CheckCircle2 size={17} className="text-[#14845d]" /> : <LoaderCircle size={17} className="animate-spin text-[#0054fc]" />}{status === "ready" ? "Primeira versão criada e salva." : stages[activeIndex]?.label || "Criando sua primeira versão…"}</span>
    <ol className="mt-4 grid gap-2">
      {stages.map((stage, index) => {
        const complete = status === "ready" || index < activeIndex;
        const active = index === activeIndex;
        return <li key={stage.phase} className={`flex items-center gap-3 text-xs ${active ? "font-bold text-[#07172f]" : "text-[#536178]"}`}><span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-black ${complete ? "bg-[#02e5cd] text-[#07172f]" : active ? "bg-[#0054fc] text-white" : "border border-[#b7c5d4]"}`}>{complete ? <Check size={12} strokeWidth={3} /> : active ? <LoaderCircle size={11} className="animate-spin" /> : index + 1}</span>{stage.label}</li>;
      })}
    </ol>
    <p className="mt-4 text-xs leading-5 text-[#687582]">As etapas refletem o salvamento real. Nada será publicado sem sua confirmação.</p>
  </div>;
}
