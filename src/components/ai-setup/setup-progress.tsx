import { CheckCircle2 } from "lucide-react";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";

export function SetupProgress({ session }: { session?: AISetupSession | null }) {
  const requirements = session?.missingRequirements || [];
  const verified = requirements.filter((item) => item.status === "verified").length;
  const base = session ? 3 : 0;
  const total = requirements.length + 3;
  const progress = total ? Math.round(((verified + base) / total) * 100) : 12;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-bold">
        <span className="flex items-center gap-2 text-[#4f4f58]"><CheckCircle2 size={15} className="text-[#6d5ef5]" /> Prontidão do rascunho</span>
        <span className="text-[#6557df]">{progress}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e6ef]"><div className="h-full rounded-full bg-[#6d5ef5] transition-[width]" style={{ width: `${progress}%` }} /></div>
      <p className="mt-2 text-[11px] leading-4 text-[#85848e]">O rascunho pode ser gerado agora; pendências continuam visíveis no editor e bloqueiam publicação quando necessário.</p>
    </div>
  );
}
