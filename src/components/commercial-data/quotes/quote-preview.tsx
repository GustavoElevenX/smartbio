"use client";

import { useMemo, useState } from "react";
import { calculateQuoteEstimate } from "@/features/quotes/quote-engine";
import { Input, Label } from "@/components/ui/field";
import type { QuoteDefinition } from "@/types";

export function QuotePreview({ definition }: { definition: QuoteDefinition }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const estimate = useMemo(() => calculateQuoteEstimate(definition, definition.rules, answers), [answers, definition]);
  const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: estimate.currency });
  const formatEstimate = (min?: number, max?: number) => min === undefined || max === undefined ? "Sob consulta" : min === max ? formatter.format(min) : `${formatter.format(min)} – ${formatter.format(max)}`;
  return <div className="rounded-[18px] bg-[#f5f4f8] p-5"><h3 className="text-sm font-extrabold">Preview sem persistência</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{definition.questions.map((question) => <div key={question.id}><Label htmlFor={`preview-${question.id}`}>{question.label}</Label><Input id={`preview-${question.id}`} value={String(answers[question.key] || "")} onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: question.type === "number" ? Number(event.target.value) : event.target.value }))} /></div>)}</div><p className="mt-5 text-sm">Estimativa: <strong>{formatEstimate(estimate.min, estimate.max)}</strong></p></div>;
}
