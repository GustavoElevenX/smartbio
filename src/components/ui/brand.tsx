import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, size = "md", className }: { compact?: boolean; size?: "sm" | "md"; className?: string }) {
  return <Link href="/" className={cn("focus-ring inline-flex items-center rounded-lg font-black tracking-[-.04em]", size === "sm" ? "gap-1.5" : "gap-2.5", className)} aria-label="Sobe, início"><Image src="/brand/sobe-symbol.png" alt="" width={40} height={40} priority className={cn("object-contain", size === "sm" ? "size-6" : "size-9")} />{!compact && <span className={size === "sm" ? "text-sm" : "text-[19px]"}>Sobe</span>}</Link>;
}
