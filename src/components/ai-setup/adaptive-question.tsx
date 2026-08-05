"use client";

import { useEffect, useState } from "react";
import { ArrowRight, HelpCircle, LoaderCircle } from "lucide-react";
import type { SetupQuestion } from "@/features/ai-setup/ai-setup.schema";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function AdaptiveQuestion({ question, busy, onAnswer }: { question: SetupQuestion; busy?: boolean; onAnswer: (value: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [question.id]);
  async function submit() { if (value.trim()) await onAnswer(value.trim()); }
  return (
    <div className="rounded-[20px] border border-[#e4e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(32,29,58,.05)]">
      <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#f0edff] text-[#6457d9]"><HelpCircle size={16} /></span><div><h3 className="text-[15px] font-extrabold leading-6 text-[#33333a]">{question.title}</h3>{question.description ? <p className="mt-1 text-xs leading-5 text-[#7b7a85]">{question.description}</p> : null}</div></div>
      {question.options?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <button key={option.value} type="button" onClick={() => setValue(option.value)} className={cn("focus-ring rounded-xl border p-3 text-left text-xs transition", value === option.value ? "border-[#6d5ef5] bg-[#f0edff] text-[#5145c0]" : "border-[#e1dfe8] hover:border-[#bdb8e4]")}><strong className="block">{option.label}</strong>{option.description ? <span className="mt-1 block leading-4 opacity-70">{option.description}</span> : null}</button>)}</div> : question.type === "textarea" || question.type === "address" ? <Textarea className="mt-4 min-h-24" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Digite sua resposta…" /> : <Input className="mt-4" type={question.type === "url" ? "url" : question.type === "phone" ? "tel" : "text"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Digite sua resposta…" />}
      <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] font-semibold text-[#8a8993]">{question.required ? "Necessário para esta capacidade" : "Pode ser ajustado depois"}</span><Button type="button" size="sm" onClick={() => void submit()} disabled={busy || !value.trim()}>{busy ? <LoaderCircle data-icon size={15} className="animate-spin" /> : <>Responder <ArrowRight data-icon size={15} /></>}</Button></div>
    </div>
  );
}
