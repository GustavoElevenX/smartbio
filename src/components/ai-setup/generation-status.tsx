import { Check, CheckCircle2, LoaderCircle } from "lucide-react";

const stages = [
  "Entendendo o seu negócio",
  "Organizando as principais ações",
  "Montando a página",
  "Conectando cada ação ao caminho certo",
  "Revisando o que falta para publicar",
];

export function GenerationStatus({ status }: { status: "idle" | "generating" | "ready" }) {
  if (status === "idle") return null;
  return <div role="status" className="border border-[#c8d9ea] bg-[#f7fbff] p-5 text-sm text-[#07172f]" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}>
    <span className="flex items-center gap-2 font-extrabold">{status === "generating" ? <LoaderCircle size={17} className="animate-spin text-[#0054fc]" /> : <CheckCircle2 size={17} className="text-[#14845d]" />}{status === "generating" ? "Criando sua primeira versão…" : "Primeira versão criada e salva."}</span>
    <ol className="mt-4 grid gap-2">
      {stages.map((stage, index) => <li key={stage} className="flex items-center gap-3 text-xs text-[#536178]"><span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-black ${status === "ready" ? "bg-[#02e5cd] text-[#07172f]" : index === 0 ? "bg-[#0054fc] text-white" : "border border-[#b7c5d4]"}`}>{status === "ready" ? <Check size={12} strokeWidth={3} /> : index + 1}</span>{stage}</li>)}
    </ol>
    <p className="mt-4 text-xs leading-5 text-[#687582]">Nada será publicado sem sua confirmação.</p>
  </div>;
}
