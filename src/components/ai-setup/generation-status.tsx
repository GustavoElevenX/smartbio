import { CheckCircle2, LoaderCircle } from "lucide-react";

export function GenerationStatus({ status }: { status: "idle" | "generating" | "ready" }) {
  if (status === "idle") return null;
  return <div role="status" className="rounded-[18px] border border-[#dedaf4] bg-[#f6f3ff] p-4 text-sm text-[#5449bd]">
    <span className="flex items-center gap-2 font-bold">{status === "generating" ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} {status === "generating" ? "Compondo etapas, blocos e requisitos…" : "Rascunho criado e salvo."}</span>
    <p className="mt-2 text-xs leading-5 text-[#74717f]">{status === "generating" ? "A SmartBio mantém informações não confirmadas como pendências editáveis." : "Revise a experiência no editor antes de publicar."}</p>
  </div>;
}
