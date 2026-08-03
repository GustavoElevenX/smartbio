import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" className={cn("focus-ring inline-flex items-center gap-2.5 rounded-lg font-extrabold tracking-[-.03em]", className)} aria-label={`${APP_NAME}, início`}>
    <span className="grid size-9 place-items-center rounded-[12px] bg-[#17171c] text-white shadow-[0_8px_22px_rgba(23,23,28,.16)]"><Sparkles size={17} strokeWidth={2.4} /></span>
    {!compact && <span>{APP_NAME}</span>}
  </Link>;
}
