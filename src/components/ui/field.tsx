import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) { return <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[#07172f]">{children}</label>; }
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn("focus-ring min-h-12 w-full rounded-xl border border-[#d7e1ec] bg-white px-3.5 text-[15px] outline-none transition placeholder:text-[#8793a5] focus:border-[#0186fc]", className)} {...props} />; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn("focus-ring min-h-28 w-full resize-y rounded-xl border border-[#d7e1ec] bg-white px-3.5 py-3 text-[15px] outline-none transition placeholder:text-[#8793a5] focus:border-[#0186fc]", className)} {...props} />; }
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn("focus-ring min-h-12 w-full rounded-xl border border-[#d7e1ec] bg-white px-3.5 text-[15px] outline-none transition focus:border-[#0186fc]", className)} {...props}>{children}</select>; }
