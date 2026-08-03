import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn("focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:active:scale-100", variant === "primary" && "bg-[#17171c] text-white shadow-[0_8px_24px_rgba(23,23,28,.16)] hover:bg-[#2b2b31]", variant === "secondary" && "border border-[#dfdee7] bg-white text-[#27272c] hover:border-[#c4c2cf] hover:bg-[#fafafd]", variant === "ghost" && "text-[#5d5d68] hover:bg-[#efeff4] hover:text-[#202026]", variant === "danger" && "bg-[#fff0f0] text-[#b72e2e] hover:bg-[#ffe3e3]", size === "sm" && "min-h-9 px-3 text-sm", size === "md" && "min-h-11 px-4 text-sm", size === "lg" && "min-h-13 px-5 text-[15px]", className)} {...props} />;
}
