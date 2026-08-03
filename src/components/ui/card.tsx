import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[22px] border border-[#e6e5ec] bg-white shadow-[0_10px_38px_rgba(24,24,40,.055)]", className)} {...props} />;
}
