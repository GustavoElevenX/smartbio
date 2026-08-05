"use client";

import { Input, Label, Select } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { QuotePreview } from "@/components/commercial-data/quotes/quote-preview";
import { QuoteQuestionBuilder } from "@/components/commercial-data/quotes/quote-question-builder";
import { QuoteRuleBuilder } from "@/components/commercial-data/quotes/quote-rule-builder";
import type { QuoteDefinition } from "@/types";

export function QuoteConfigPanel({ value, onChange }: { value: QuoteDefinition; onChange: (value: QuoteDefinition) => void }) {
  const patch = (next: Partial<QuoteDefinition>) => onChange({ ...value, ...next });
  return <section className="flex flex-col gap-7"><div><h2 className="text-lg font-extrabold">Orçamentos</h2><p className="mt-1 text-sm text-[#74747e]">Perguntas, regras, revisão e estimativa apresentada ao visitante.</p></div><div className="grid gap-5 sm:grid-cols-3"><div><Label htmlFor="quote-name">Nome</Label><Input id="quote-name" value={value.title} onChange={(event) => patch({ title: event.target.value })} /></div><div><Label htmlFor="quote-mode">Modo</Label><Select id="quote-mode" value={value.estimationMode} onChange={(event) => patch({ estimationMode: event.target.value as QuoteDefinition["estimationMode"] })}><option value="manual">Manual</option><option value="exact">Exato</option><option value="range">Faixa</option><option value="starting_at">A partir de</option></Select></div><div><Label htmlFor="quote-base">Preço base</Label><Input id="quote-base" type="number" min="0" step="0.01" value={value.baseAmount ?? ""} onChange={(event) => patch({ baseAmount: event.target.value ? Number(event.target.value) : undefined })} /></div><label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={value.isActive} onCheckedChange={(checked) => patch({ isActive: checked })} />Receber orçamentos</label></div><QuoteQuestionBuilder questions={value.questions} onChange={(questions) => patch({ questions })} /><QuoteRuleBuilder questions={value.questions} rules={value.rules} onChange={(rules) => patch({ rules })} /><QuotePreview definition={value} /></section>;
}
