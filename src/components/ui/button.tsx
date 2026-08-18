import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" | "icon" };

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn("focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:active:scale-100", variant === "primary" && "bg-[#0054fc] text-white shadow-[0_8px_24px_rgba(0,84,252,.22)] hover:bg-[#0048d9]", variant === "secondary" && "border border-[#d7e1ec] bg-white text-[#07172f] hover:border-[#9fc3ff] hover:bg-[#f7fbff]", variant === "ghost" && "text-[#536178] hover:bg-[#eaf3ff] hover:text-[#0054fc]", variant === "danger" && "bg-[#fff0f0] text-[#b72e2e] hover:bg-[#ffe3e3]", size === "sm" && "min-h-9 px-3 text-sm", size === "md" && "min-h-11 px-4 text-sm", size === "lg" && "min-h-13 px-5 text-[15px]", size === "icon" && "size-9 p-0", className)} {...props} />;
}
