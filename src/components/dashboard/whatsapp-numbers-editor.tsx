"use client";

import { MessageCircle, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import {
  createProjectWhatsAppNumber,
  projectWhatsAppNumbers,
  updateProjectWhatsAppNumbers,
  whatsappNumberErrors,
} from "@/features/whatsapp/project-whatsapp-numbers";
import type { Project, RoutingDestination } from "@/types";

export function WhatsAppNumbersEditor({ project, onChange }: { project: Project; onChange(project: Project): void }) {
  const numbers = projectWhatsAppNumbers(project);
  const errors = whatsappNumberErrors(numbers);
  const patch = (id: string, change: Partial<RoutingDestination>) => onChange(updateProjectWhatsAppNumbers(project, numbers.map((item) => item.id === id ? { ...item, ...change } : item)));
  const makePrimary = (id: string) => onChange(updateProjectWhatsAppNumbers(project, numbers.map((item) => ({ ...item, isDefault: item.id === id }))));
  const remove = (id: string) => {
    const remaining = numbers.filter((item) => item.id !== id);
    if (remaining.length && !remaining.some((item) => item.isDefault)) remaining[0] = { ...remaining[0], isDefault: true };
    onChange(updateProjectWhatsAppNumbers(project, remaining));
  };
  const add = () => onChange(updateProjectWhatsAppNumbers(project, [...numbers, createProjectWhatsAppNumber(numbers.length === 0)]));

  return <fieldset className="sm:col-span-2">
    <legend className="flex items-center gap-2 text-sm font-extrabold text-[#17171c]"><MessageCircle size={17} className="text-[#15966c]" /> Números de WhatsApp</legend>
    <p className="mt-1 max-w-2xl text-xs leading-5 text-[#6f7480]">Cadastre os atendimentos do negócio e escolha o principal. Ele será usado quando um botão não tiver um destino específico.</p>
    <div className="mt-4 divide-y divide-[#e4e7ec] border-y border-[#e4e7ec]">
      {numbers.length ? numbers.map((item, index) => {
        const itemErrors = errors[item.id];
        return <div key={item.id} className="grid gap-3 py-4 md:grid-cols-[minmax(160px,.8fr)_minmax(220px,1fr)_auto] md:items-start">
          <div>
            <Label htmlFor={`whatsapp-label-${item.id}`}>Nome do atendimento</Label>
            <Input id={`whatsapp-label-${item.id}`} value={item.label} maxLength={180} aria-invalid={Boolean(itemErrors?.label)} aria-describedby={itemErrors?.label ? `whatsapp-label-error-${item.id}` : undefined} onChange={(event) => patch(item.id, { label: event.target.value })} placeholder={index === 0 ? "Atendimento principal" : "Vendas, suporte…"} />
            {itemErrors?.label ? <p id={`whatsapp-label-error-${item.id}`} className="mt-1 text-xs font-semibold text-red-600">{itemErrors.label}</p> : null}
          </div>
          <div>
            <Label htmlFor={`whatsapp-phone-${item.id}`}>Número</Label>
            <Input id={`whatsapp-phone-${item.id}`} type="tel" inputMode="tel" value={item.value || ""} aria-invalid={Boolean(itemErrors?.phone)} aria-describedby={itemErrors?.phone ? `whatsapp-phone-error-${item.id}` : undefined} onChange={(event) => patch(item.id, { value: event.target.value })} placeholder="55 11 99999-9999" />
            {itemErrors?.phone ? <p id={`whatsapp-phone-error-${item.id}`} className="mt-1 text-xs font-semibold text-red-600">{itemErrors.phone}</p> : null}
          </div>
          <div className="flex min-h-11 items-center justify-between gap-2 md:mt-5 md:justify-end">
            {item.isDefault ? <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#e9f8f1] px-3 text-xs font-extrabold text-[#087756]"><Star size={13} fill="currentColor" aria-hidden /> Principal</span> : <button type="button" onClick={() => makePrimary(item.id)} className="focus-ring min-h-9 rounded-xl px-3 text-xs font-bold text-[#0054fc] hover:bg-[#eef6ff]">Tornar principal</button>}
            <button type="button" onClick={() => remove(item.id)} aria-label={`Remover ${item.label || `número ${index + 1}`}`} className="focus-ring grid size-10 place-items-center rounded-xl text-[#a43b3b] hover:bg-red-50"><Trash2 size={16} aria-hidden /></button>
          </div>
        </div>;
      }) : <div className="py-6 text-center"><strong className="text-sm">Nenhum WhatsApp cadastrado</strong><p className="mt-1 text-xs text-[#747781]">Adicione o primeiro número para usar nos botões e jornadas.</p></div>}
    </div>
    <Button type="button" variant="secondary" className="mt-4" onClick={add} disabled={numbers.length >= 20}><Plus size={16} /> Adicionar número</Button>
    {numbers.length >= 20 ? <p className="mt-2 text-xs font-semibold text-amber-700">Limite de 20 números por negócio.</p> : null}
  </fieldset>;
}
