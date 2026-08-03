import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) { return <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[#34343b]">{children}</label>; }
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn("focus-ring min-h-12 w-full rounded-xl border border-[#dedde6] bg-white px-3.5 text-[15px] outline-none transition placeholder:text-[#aaa9b4] focus:border-[#8f84f7]", className)} {...props} />; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn("focus-ring min-h-28 w-full resize-y rounded-xl border border-[#dedde6] bg-white px-3.5 py-3 text-[15px] outline-none transition placeholder:text-[#aaa9b4] focus:border-[#8f84f7]", className)} {...props} />; }
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn("focus-ring min-h-12 w-full rounded-xl border border-[#dedde6] bg-white px-3.5 text-[15px] outline-none transition focus:border-[#8f84f7]", className)} {...props}>{children}</select>; }
