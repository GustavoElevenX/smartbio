"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, ExternalLink, GitBranch, MapPin, MessageCircle, PencilLine, Route, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import type { CommercialArchitecture } from "@/features/ai-setup/ai-setup.schema";

const modeLabels: Record<CommercialArchitecture["journeyBlueprints"][number]["mode"], string> = {
  direct_external: "abre o link direto",
  direct_contact: "abre o contato direto",
  routing: "encaminha para a unidade certa",
  catalog: "organiza a escolha de produtos",
  qualification: "entende a necessidade antes do contato",
  quote: "coleta o necessário para orçamento",
  scheduling: "organiza o agendamento",
  reservation: "consulta e solicita reserva",
  guided_flow: "conduz uma sequência curta",
  hybrid: "combina etapas e destinos",
};

function PathIcon({ mode }: { mode: CommercialArchitecture["journeyBlueprints"][number]["mode"] }) {
  const Icon = mode === "direct_external" ? ExternalLink : mode === "direct_contact" ? MessageCircle : mode === "routing" ? MapPin : mode === "hybrid" ? GitBranch : Route;
  return <Icon aria-hidden size={18} />;
}

interface CommercialArchitectureReviewProps {
  architecture: CommercialArchitecture;
  busy: boolean;
  onConfirm: () => Promise<void>;
  onUpdate: (architecture: CommercialArchitecture) => Promise<void>;
}

export function CommercialArchitectureReview({ architecture, busy, onConfirm, onUpdate }: CommercialArchitectureReviewProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(architecture);
  useEffect(() => setDraft(architecture), [architecture]);
  const channelById = new Map(draft.channels.map((channel) => [channel.id, channel]));
  const intentById = new Map(draft.intents.map((intent) => [intent.id, intent]));

  function updateIntent(intentId: string, label: string) {
    setDraft((current) => ({ ...current, intents: current.intents.map((intent) => intent.id === intentId ? { ...intent, label } : intent) }));
  }

  function updateDestination(blueprintId: string, channelId: string) {
    setDraft((current) => ({
      ...current,
      journeyBlueprints: current.journeyBlueprints.map((blueprint) => blueprint.id === blueprintId ? {
        ...blueprint,
        completion: {
          ...blueprint.completion,
          channelId: channelId || null,
          destinationStrategy: channelId ? (current.channels.find((channel) => channel.id === channelId)?.type === "external_url" ? "external_url" : "fixed") : "native",
        },
      } : blueprint),
    }));
  }

  return (
    <section aria-labelledby="architecture-review-title" className="overflow-hidden border border-[#cbd8e7] bg-white shadow-[0_18px_48px_rgba(7,23,47,.08)]" style={{ clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)" }}>
      <div className="sobe-gradient-rule" />
      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center bg-[#e9fffc] text-[#07172f]"><Sparkles aria-hidden size={19} /></span>
          <div className="min-w-0">
            <h2 id="architecture-review-title" className="text-balance text-xl font-extrabold tracking-[-.025em] text-[#07172f] sm:text-2xl">Entendi seu negócio assim.</h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[#536178]">A Sobe conectou cada intenção ao caminho mais curto que faz sentido. Você confirma a leitura inteira ou ajusta apenas o que mudou.</p>
          </div>
        </div>

        <div className="mt-6 border-y border-[#dfe6ee]">
          {draft.journeyBlueprints.map((blueprint) => {
            const intent = intentById.get(blueprint.intentId);
            if (!intent) return null;
            const channel = channelById.get(blueprint.completion.channelId || "");
            const collects = [...new Set(blueprint.steps.flatMap((step) => step.collects))];
            const locations = blueprint.steps.flatMap((step) => step.usesLocations).map((id) => draft.locations.find((location) => location.id === id)?.label).filter((label): label is string => Boolean(label));
            return (
              <div key={blueprint.id} className="grid gap-4 border-b border-[#dfe6ee] py-5 last:border-b-0 sm:grid-cols-[44px_minmax(0,1fr)]">
                <span className="grid size-11 place-items-center rounded-full bg-[#07172f] text-[#02e5cd]"><PathIcon mode={blueprint.mode} /></span>
                <div className="min-w-0">
                  {editing ? <div><Label htmlFor={`intent-${intent.id}`}>Nome do caminho</Label><Input id={`intent-${intent.id}`} value={intent.label} onChange={(event) => updateIntent(intent.id, event.target.value)} maxLength={100} /></div> : <h3 className="text-base font-extrabold text-[#07172f]">{intent.label}</h3>}
                  <p className="mt-1 text-sm leading-6 text-[#536178]"><span className="font-bold text-[#0054fc]">{modeLabels[blueprint.mode]}</span>{channel ? ` → ${channel.label}` : ""}</p>
                  {collects.length ? <p className="mt-2 text-xs leading-5 text-[#687582]">Antes de concluir, coleta: {collects.join(", ")}.</p> : null}
                  {locations.length ? <p className="mt-1 text-xs leading-5 text-[#687582]">Unidades envolvidas: {[...new Set(locations)].join(", ")}.</p> : null}
                  {editing ? <div className="mt-3"><Label htmlFor={`channel-${blueprint.id}`}>Destino deste caminho</Label><Select id={`channel-${blueprint.id}`} value={blueprint.completion.channelId || ""} onChange={(event) => updateDestination(blueprint.id, event.target.value)}><option value="">Concluir dentro da Sobe</option>{draft.channels.filter((item) => item.value).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</Select></div> : null}
                  {blueprint.requiredFacts.length ? <div className="mt-3 bg-[#fff9e9] px-3 py-2 text-xs leading-5 text-[#795b16]">Precisa confirmar: {blueprint.requiredFacts.map((fact) => fact.label).join(", ")}.</div> : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {editing ? <>
            <Button type="button" size="lg" onClick={() => void onUpdate(draft).then(() => setEditing(false)).catch(() => undefined)} disabled={busy}><Save aria-hidden data-icon size={17} /> {busy ? "Salvando ajustes…" : "Salvar e continuar"}</Button>
            <Button type="button" size="lg" variant="ghost" onClick={() => { setDraft(architecture); setEditing(false); }} disabled={busy}>Cancelar</Button>
          </> : <>
            <Button type="button" size="lg" onClick={() => void onConfirm()} disabled={busy || architecture.status === "degraded"}><Check aria-hidden data-icon size={17} /> {busy ? "Confirmando…" : "Está certo, continuar"}</Button>
            <Button type="button" size="lg" variant="secondary" onClick={() => setEditing(true)} disabled={busy}><PencilLine aria-hidden data-icon size={17} /> Ajustar</Button>
            <span className="hidden items-center gap-1 text-xs font-bold text-[#687582] sm:ml-auto sm:flex">Próximo: só o que estiver faltando <ArrowRight aria-hidden size={14} /></span>
          </>}
        </div>
      </div>
    </section>
  );
}
