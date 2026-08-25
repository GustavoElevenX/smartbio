"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, HelpCircle, LoaderCircle, PencilLine, Sparkles } from "lucide-react";
import type { SetupQuestion } from "@/features/ai-setup/ai-setup.schema";
import { adaptiveQuestionSuggestion, editedAdaptiveQuestionAnswer } from "@/features/ai-setup/adaptive-question-suggestion";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function AdaptiveQuestion({ question, busy, onAnswer }: { question: SetupQuestion; busy?: boolean; onAnswer: (value: unknown) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [editingSuggestion, setEditingSuggestion] = useState(false);
  const suggestion = useMemo(() => adaptiveQuestionSuggestion(question), [question]);
  useEffect(() => {
    setValue(suggestion?.displayText || "");
    setEditingSuggestion(!suggestion);
  }, [question.id, suggestion]);
  async function submit(nextValue: unknown = value) {
    if (Array.isArray(nextValue) ? nextValue.length : String(nextValue).trim()) {
      await onAnswer(Array.isArray(nextValue) ? nextValue : String(nextValue).trim());
    }
  }
  const showSuggestion = Boolean(suggestion && !editingSuggestion);
  return (
    <div data-setup-question className="rounded-[20px] border border-[#e4e2ec] bg-white p-5 shadow-[0_8px_28px_rgba(32,29,58,.05)]">
      <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#eaf3ff] text-[#0054fc]"><HelpCircle size={16} /></span><div><h3 className="text-[15px] font-extrabold leading-6 text-[#33333a]">{question.title}</h3>{question.description ? <p className="mt-1 text-xs leading-5 text-[#7b7a85]">{question.description}</p> : null}</div></div>
      {showSuggestion ? <div className="mt-4 rounded-xl border border-[#cfe0ff] bg-[#f3f7ff] p-4"><span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#0054fc]"><Sparkles size={13} /> Sugestão da Sobe</span>{suggestion?.structured ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#344150]">{suggestion.visibleLines.map((line, index) => <li key={`${question.id}-${index}`} data-structured-question>{line}</li>)}</ol> : <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#344150]">{suggestion?.displayText}</p>}</div> : question.options?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option) => <button key={option.value} type="button" onClick={() => setValue(option.value)} className={cn("focus-ring rounded-xl border p-3 text-left text-xs transition", value === option.value ? "border-[#0054fc] bg-[#eaf3ff] text-[#0054fc]" : "border-[#e1dfe8] hover:border-[#9fc3ff]")}><strong className="block">{option.label}</strong>{option.description ? <span className="mt-1 block leading-4 opacity-70">{option.description}</span> : null}</button>)}</div> : question.type === "textarea" || question.type === "address" ? <Textarea className="mt-4 min-h-24" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Digite sua resposta…" /> : <Input className="mt-4" type={question.type === "url" ? "url" : question.type === "phone" ? "tel" : "text"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Digite sua resposta…" />}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[10px] font-semibold text-[#8a8993]">{question.required ? "Necessário para criar a primeira versão" : "Opcional — você pode preencher depois"}</span><div className="flex flex-wrap gap-2">{showSuggestion ? <Button type="button" size="sm" variant="secondary" onClick={() => setEditingSuggestion(true)} disabled={busy}><PencilLine data-icon size={14} /> Editar</Button> : null}<Button type="button" size="sm" onClick={() => void submit(showSuggestion ? suggestion!.submission : editedAdaptiveQuestionAnswer(question, value))} disabled={busy || (!showSuggestion && !value.trim())}>{busy ? <><LoaderCircle data-icon size={15} className="animate-spin" /> Salvando…</> : showSuggestion ? <>Usar assim <ArrowRight data-icon size={15} /></> : <>Salvar resposta <ArrowRight data-icon size={15} /></>}</Button></div></div>
    </div>
  );
}
