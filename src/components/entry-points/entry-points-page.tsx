"use client";

import Link from "next/link";
import { ArrowLeft, Check, Link2, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EntryPointCard } from "./entry-point-card";
import { EntryPointPreview } from "./entry-point-preview";
import { EntryPointQr } from "./entry-point-qr";
import { backfillConversionGoals } from "@/features/conversion-goals/utils";
import { setProjectEntryPoints } from "@/features/entry-points/service";
import { entryPointUrl } from "@/features/entry-points/url";
import { applyEntryChannelPreset, ENTRY_CHANNEL_PRESETS } from "@/features/entry-points/presets";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { EntryPoint, Project } from "@/types";

const field = "mt-2 min-h-11 w-full rounded-xl border border-[#dddbe4] bg-white px-3 text-sm";

export function EntryPointsPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [entries, setEntries] = useState<EntryPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void projectRepository.getProject(projectId).then((found) => { setProject(found || null); setEntries(found?.entryPoints || []); setSelectedId(found?.entryPoints?.[0]?.id); }).catch(() => setProject(null)); }, [projectId]);
  if (project === undefined) return <div className="h-80 animate-pulse rounded-[24px] bg-white" />;
  if (!project) return <div className="rounded-[24px] bg-white p-10 text-center">Negócio não encontrado.</div>;
  const goals = backfillConversionGoals(project);
  const presencePages = project.presence?.pages.filter((page) => page.isActive) || [];
  const selected = entries.find((entry) => entry.id === selectedId);
  const patchEntry = (id: string, patch: Partial<EntryPoint>) => setEntries((items) => items.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  async function save() { if (!project) return; setSaving(true); setError(""); try { const persisted = await projectRepository.saveProject(setProjectEntryPoints(project, entries)); setProject(persisted); setSaved(true); setTimeout(() => setSaved(false), 1500); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); } finally { setSaving(false); } }
  function addEntry() {
    if (!project) return;
    const id = crypto.randomUUID(); const home = presencePages.find((page) => page.isHome);
    setEntries((items) => [...items, { id, projectId: project.id, key: `entrada-${items.length + 1}`, name: "Nova entrada", surfaceMode: home ? "presence" : "conversion_direct", presencePageId: home?.id, conversionGoalId: home ? undefined : goals[0]?.id, targetStepId: home || goals[0] ? undefined : project.steps[0]?.id, channel: "other", isActive: true }]);
    setSelectedId(id);
  }
  return <div className="animate-enter">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><Link href={`/app/projects/${project.id}`} className="inline-flex items-center gap-2 text-xs font-bold text-[#74727d]"><ArrowLeft size={14} /> {project.name}</Link><div className="mt-4 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-[15px] bg-[#eaf3ff] text-[#0054fc]"><Link2 /></span><div><h1 className="text-3xl font-extrabold tracking-[-.045em]">Entradas</h1><p className="mt-1 text-sm text-[#74727d]">Escolha a superfície certa para cada canal e campanha.</p></div></div></div><div className="flex gap-2"><Button variant="secondary" onClick={addEntry}><Plus /> Entrada</Button><Button onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}{saving ? "Salvando" : saved ? "Salvo" : "Salvar"}</Button></div></header>
    <section className="mt-7 grid gap-5 xl:grid-cols-[.82fr_1.18fr]"><div><h2 className="text-lg font-extrabold">Links publicados</h2><div className="mt-4 grid gap-3">{entries.length ? entries.map((entry) => <button type="button" key={entry.id} aria-pressed={selectedId === entry.id} className={`cursor-pointer rounded-[22px] text-left ${selectedId === entry.id ? "ring-2 ring-[#0054fc] ring-offset-2" : ""}`} onClick={() => setSelectedId(entry.id)}><EntryPointCard entry={entry} goal={goals.find((goal) => goal.id === entry.conversionGoalId)} url={entryPointUrl(project.slug, entry)} /></button>) : <div className="rounded-[20px] border border-dashed border-[#d9d6e1] p-10 text-center"><strong>Nenhuma entrada criada</strong><p className="mt-2 text-xs text-[#77747f]">Crie um link para bio, anúncio, story ou QR code.</p></div>}</div></div>
      <div>{selected ? <div className="grid gap-4"><div className="rounded-[24px] border border-[#e2e0e8] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-extrabold">Configurar entrada</h2><Button variant="ghost" size="icon" aria-label="Excluir entrada" onClick={() => { setEntries((items) => items.filter((entry) => entry.id !== selected.id)); setSelectedId(undefined); }}><Trash2 /></Button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold">Nome<input value={selected.name} onChange={(event) => patchEntry(selected.id, { name: event.target.value })} className={field} /></label>
          <label className="text-xs font-bold">Chave da URL<input value={selected.key} onChange={(event) => patchEntry(selected.id, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })} className={field} /></label>
          <label className="text-xs font-bold">Canal<select value={selected.channel} onChange={(event) => patchEntry(selected.id, applyEntryChannelPreset(selected, event.target.value as EntryPoint["channel"]))} className={field}>{ENTRY_CHANNEL_PRESETS.map((preset) => <option key={preset.key} value={preset.key}>{preset.label}</option>)}</select></label>
          <label className="text-xs font-bold">Superfície<select value={selected.surfaceMode || "conversion_direct"} onChange={(event) => { const surfaceMode = event.target.value as NonNullable<EntryPoint["surfaceMode"]>; patchEntry(selected.id, { surfaceMode, presencePageId: surfaceMode === "conversion_direct" ? undefined : selected.presencePageId || presencePages.find((page) => page.isHome)?.id, conversionGoalId: surfaceMode === "conversion_direct" ? selected.conversionGoalId || goals[0]?.id : selected.conversionGoalId }); }} className={field}><option value="presence">Site / presença</option><option value="landing">Landing page</option><option value="conversion_direct">Conversão direta</option></select></label>
          {selected.surfaceMode !== "conversion_direct" ? <label className="text-xs font-bold">Página de entrada<select value={selected.presencePageId || ""} onChange={(event) => patchEntry(selected.id, { presencePageId: event.target.value || undefined })} className={field}><option value="">Selecione</option>{presencePages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}</select></label> : null}
          <label className="text-xs font-bold">Meta de conversão<select value={selected.conversionGoalId || ""} onChange={(event) => patchEntry(selected.id, { conversionGoalId: event.target.value || undefined })} className={field}><option value="">{selected.surfaceMode === "conversion_direct" ? "Etapa direta" : "Usar CTAs da página"}</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label>
          {[["Origem", "utmSource"], ["Mídia", "utmMedium"], ["Campanha", "utmCampaign"], ["Conteúdo", "utmContent"], ["Termo (opcional)", "utmTerm"]].map(([title, key]) => <label key={key} className="text-xs font-bold">{title}<input value={String(selected[key as keyof EntryPoint] || "")} onChange={(event) => patchEntry(selected.id, { [key]: event.target.value || undefined })} className={field} /></label>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex min-h-11 items-center gap-2 text-xs font-bold"><input type="checkbox" checked={selected.isActive} onChange={(event) => patchEntry(selected.id, { isActive: event.target.checked })} /> Entrada ativa</label>{selected.surfaceMode === "landing" ? <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfdee7] bg-white px-4 text-sm font-semibold text-[#27272c] hover:bg-[#f7fbff]" href={`/app/projects/${project.id}/site?compose=landing&entry=${selected.id}`}><Sparkles size={15} />Criar landing para esta entrada</Link> : null}</div>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}</div>
        <div className="grid gap-4 sm:grid-cols-2"><EntryPointPreview entry={selected} goal={goals.find((goal) => goal.id === selected.conversionGoalId)} /><EntryPointQr url={entryPointUrl(project.slug, selected)} name={selected.name} /></div>
      </div> : <div className="rounded-[24px] border border-dashed border-[#d9d6e1] p-12 text-center text-sm text-[#77747f]">Selecione ou crie uma entrada.</div>}</div>
    </section>
  </div>;
}
