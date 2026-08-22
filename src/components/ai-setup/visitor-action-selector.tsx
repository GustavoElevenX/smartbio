"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { visitorActionCatalog, type VisitorActionKey, type VisitorActionSelection } from "@/features/ai-setup/visitor-actions";

export function VisitorActionSelector({ initialActions, busy, onConfirm }: { initialActions: VisitorActionSelection[]; busy?: boolean; onConfirm(actions: VisitorActionSelection[]): Promise<void> }) {
  const [selected, setSelected] = useState<VisitorActionKey[]>([]);
  const [primary, setPrimary] = useState<VisitorActionKey>();
  const [otherLabel, setOtherLabel] = useState("");
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    setSelected(initialActions.map((action) => action.key));
    setPrimary(initialActions.find((action) => action.isPrimary)?.key || initialActions[0]?.key);
    setOtherLabel(initialActions.find((action) => action.key === "other")?.label || "");
    setSelectionError("");
  }, [initialActions]);

  function toggle(key: VisitorActionKey) {
    if (!selected.includes(key) && selected.length >= 8) {
      setSelectionError("Você pode escolher até 8 ações. Remova uma para adicionar outra.");
      return;
    }
    setSelectionError("");
    setSelected((current) => {
      if (current.includes(key)) {
        const next = current.filter((item) => item !== key);
        if (primary === key) setPrimary(next[0]);
        return next;
      }
      const next = [...current, key];
      if (!primary) setPrimary(key);
      return next;
    });
  }

  async function confirm() {
    if (!selected.length || !primary) return;
    await onConfirm(selected.map((key) => {
      const definition = visitorActionCatalog.find((item) => item.key === key)!;
      return { key, label: key === "other" && otherLabel.trim() ? otherLabel.trim() : definition.label, isPrimary: key === primary };
    }));
  }

  return (
    <section aria-labelledby="visitor-actions-title" className="border-y border-[#dfe6ee] py-6">
      <h2 id="visitor-actions-title" className="max-w-2xl text-2xl font-extrabold tracking-[-.035em] text-[#07172f]">Quando alguém entrar no seu link, o que você quer que essa pessoa consiga fazer?</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687582]">Pelo que entendi, estas são as ações mais importantes. Pode ajustar antes de continuar.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><strong className="text-[#07172f]">Recomendamos de 2 a 5 ações</strong><span className="text-[#687582]">para manter a primeira página clara.</span><span className="font-bold text-[#0054fc]">{selected.length} selecionada{selected.length === 1 ? "" : "s"}</span></div>
      {selected.length > 5 ? <div role="alert" className="mt-4 flex max-w-2xl items-start gap-2 border border-[#f0d28f] bg-[#fff9e9] p-3 text-sm leading-5 text-[#795b16]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>Você selecionou {selected.length} ações. Muitas opções podem deixar a primeira página confusa; tente manter apenas os 2 a 5 caminhos mais importantes.</span></div> : null}
      {selectionError ? <div role="alert" className="mt-3 text-sm font-semibold text-[#a33b35]">{selectionError}</div> : null}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {visitorActionCatalog.map((action) => {
          const active = selected.includes(action.key);
          return <div key={action.key} className={`min-h-[92px] border p-3 transition ${active ? "border-[#0054fc] bg-[#f3f7ff]" : "border-[#dfe6ee] bg-white hover:border-[#91a4ba]"}`} style={{ clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)" }}>
            <div className="flex items-start gap-3">
              <button type="button" aria-pressed={active} onClick={() => toggle(action.key)} className={`focus-ring mt-0.5 grid size-6 shrink-0 place-items-center border ${active ? "border-[#0054fc] bg-[#0054fc] text-white" : "border-[#9aa8b8] bg-white"}`} aria-label={`${active ? "Remover" : "Adicionar"} ${action.label}`}>{active ? <Check size={14} /> : null}</button>
              <button type="button" onClick={() => toggle(action.key)} className="min-w-0 flex-1 text-left"><strong className="block text-sm text-[#07172f]">{action.label}</strong><span className="mt-1 block text-xs leading-5 text-[#687582]">{action.description}</span></button>
              {active ? <button type="button" onClick={() => setPrimary(action.key)} className={`focus-ring grid min-h-10 shrink-0 place-items-center gap-1 px-2 text-xs font-extrabold ${primary === action.key ? "text-[#0054fc]" : "text-[#718096]"}`} aria-label={`Marcar ${action.label} como ação principal`}><Star size={15} fill={primary === action.key ? "currentColor" : "none"} />{primary === action.key ? "Principal" : "Priorizar"}</button> : null}
            </div>
            {action.key === "other" && active ? <Input aria-label="Descreva a outra ação" className="mt-3" value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} placeholder="Ex.: Solicitar uma demonstração" /> : null}
          </div>;
        })}
      </div>
      <Button type="button" size="lg" className="mt-5" onClick={() => void confirm()} disabled={busy || !selected.length || !primary || (selected.includes("other") && !otherLabel.trim())}>{busy ? <LoaderCircle data-icon size={17} className="animate-spin" /> : null}Continuar</Button>
    </section>
  );
}
