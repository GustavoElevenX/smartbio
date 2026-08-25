import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";
import { buildSetupProgressStages } from "@/features/ai-setup/setup-readiness";

export function SetupProgress({ session }: { session?: AISetupSession | null }) {
  const stages = buildSetupProgressStages(session);
  return (
    <div className="grid gap-3">
      {stages.map((stage) => {
        const Icon = stage.status === "complete" ? CheckCircle2 : stage.status === "current" ? CircleDot : Circle;
        return <div key={stage.key} className="flex items-start gap-2.5">
          <Icon size={16} className={stage.status === "complete" ? "mt-0.5 text-[#1b9a70]" : stage.status === "current" ? "mt-0.5 text-[#0054fc]" : "mt-0.5 text-[#a6a4ae]"} />
          <div><strong className="block text-xs text-[#4f4f58]">{stage.label}</strong><span className="mt-0.5 block text-[10px] leading-4 text-[#85848e]">{stage.detail}</span></div>
        </div>;
      })}
    </div>
  );
}
