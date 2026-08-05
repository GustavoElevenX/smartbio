import { Bot, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function AIMessage({ role, children }: { role: "assistant" | "user"; children: React.ReactNode }) {
  const Icon = role === "assistant" ? Bot : UserRound;
  return (
    <div className={cn("flex gap-3", role === "user" && "justify-end")}>
      {role === "assistant" ? <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eeeaff] text-[#5f51d5]"><Icon size={17} /></span> : null}
      <div className={cn("max-w-[680px] rounded-[18px] px-4 py-3 text-sm leading-6", role === "assistant" ? "border border-[#e7e5ef] bg-white text-[#4f4f59]" : "bg-[#17171c] text-white")}>
        {children}
      </div>
    </div>
  );
}
