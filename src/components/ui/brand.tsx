import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <Link href="/" className={cn("focus-ring inline-flex items-center gap-2.5 rounded-lg font-black tracking-[-.04em]", className)} aria-label="Sobe, início"><Image src="/brand/sobe-symbol.png" alt="" width={40} height={40} priority className="size-9 object-contain" />{!compact && <span className="text-[19px]">Sobe</span>}</Link>;
}
