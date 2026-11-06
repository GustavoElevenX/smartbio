"use client";

import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { WhatsAppNumbersEditor } from "@/components/dashboard/whatsapp-numbers-editor";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { analyzeBrandFile } from "@/features/brand-intelligence/brand-analyzer";
import { ensureAccessiblePalette } from "@/features/brand-intelligence/colors";
import { discoveryPlanSchema } from "@/features/qualification/discovery-plan";
import { withDiscoveryQuestions } from "@/features/simple-settings/edits";
import { primaryWhatsAppDestination, whatsappNumberErrors, projectWhatsAppNumbers } from "@/features/whatsapp/project-whatsapp-numbers";
import type { Project, MediaAsset } from "@/types";
import type { ProjectCommercialContext } from "@/features/commercial-context/project-commercial-context.schema";

interface Props {
  project: Project;
  onChange(project: Project): void;
  onSave(): void;
  onContextDirtyChange?(dirty: boolean): void;
  saved: boolean;
  saveError: string;
  dirty: boolean;
  saving: boolean;
  active?: boolean;
}

type Section = "business" | "service" | "questions" | "appearance";
const actionClass = "focus-ring inline-flex min-h-11 items-center text-sm font-bold text-[#0054fc] hover:text-[#0048d9]";

export function SimpleSettings({ project, onChange, onSave, onContextDirtyChange, saved, saveError, dirty, saving, active = true }: Props) {
  const [open, setOpen] = useState<Section | null>(null);
  const [context, setContext] = useState<ProjectCommercialContext | null>(null);
  const [contextDraft, setContextDraft] = useState<ProjectCommercialContext | null>(null);
  const [contextDirty, setContextDirty] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextError, setContextError] = useState("");
  const [contextSaved, setContextSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [requestedChannel, setRequestedChannel] = useState("whatsapp");
  const [media, setMedia] = useState<Array<MediaAsset & { url?: string }>>([]);
  useEffect(() => {
    let active = true;
    void fetch(`/api/projects/${project.id}/commercial-context`).then(async (response) => {
      if (!response.ok) throw new Error("Não foi possível carregar o que a SOBE entendeu.");
      return response.json() as Promise<{ data?: ProjectCommercialContext | null }>;
    }).then((payload) => { if (active) { setContext(payload.data || null); setContextDraft(payload.data || null); setContextError(""); } })
      .catch((error) => { if (active) setContextError(error instanceof Error ? error.message : "Não foi possível carregar o contexto."); });
    void fetch(`/api/projects/${project.id}/media`).then((response) => response.ok ? response.json() : null)
      .then((payload: { data?: Array<MediaAsset & { url?: string }> } | null) => { if (active) setMedia(payload?.data || []); }).catch(() => {});
    return () => { active = false; };
  }, [project.id]);
  const base = `/app/projects/${project.id}`;
  const goals = [...(project.conversionGoals || [])].sort((a, b) => a.order - b.order);
  const questions = project.discoveryPlan?.questions || [];
  const linkedQuestions = Boolean(project.discoveryPlan && project.steps.some((step) => step.settings?.discoveryPlanId === project.discoveryPlan?.id && step.formFields?.some((field) => questions.some((question) => question.id === field.id))));
  const primaryNumber = primaryWhatsAppDestination(project);
  const homePresencePage = project.publication?.homeMode === "site" ? project.presence?.pages.find((page) => page.isHome && page.isActive) : undefined;
  const canEditCover = Boolean(homePresencePage?.sections.some((section) => section.type === "hero" && section.isActive));
  const cover = project.presence?.pages.flatMap((page) => page.sections).find((section) => section.type === "hero" && section.style.backgroundAssetId)?.style.backgroundAssetId;
  const patch = (change: Partial<Project>) => onChange({ ...project, ...change });
  const editContext = (next: ProjectCommercialContext) => { setContextDraft(next); setContextDirty(true); onContextDirtyChange?.(true); setContextSaved(false); setContextError(""); };
  async function saveContext() {
    if (!context || !contextDraft) return;
    setContextSaving(true); setContextError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/commercial-context`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: context.revision, context: contextDraft }) });
      const payload = await response.json() as { data?: ProjectCommercialContext; error?: string };
      if (!response.ok || !payload.data) throw new Error(response.status === 409 ? "O contexto mudou em outra tela. Recarregue para revisar antes de salvar novamente." : payload.error || "Não foi possível salvar o contexto.");
      setContext(payload.data); setContextDraft(payload.data); setContextDirty(false); onContextDirtyChange?.(false); setContextSaved(true);
    } catch (error) { setContextError(error instanceof Error ? error.message : "Não foi possível salvar o contexto."); }
    finally { setContextSaving(false); }
  }
  const updateQuestion = (index: number, change: Partial<(typeof questions)[number]>) => {
    if (!project.discoveryPlan) return;
    const next = questions.map((question, position) => position === index ? { ...question, ...change } : question);
    onChange(withDiscoveryQuestions(project, next));
  };
  const moveQuestion = (index: number, direction: -1 | 1) => {
    if (!project.discoveryPlan || index + direction < 0 || index + direction >= questions.length) return;
    const next = [...questions]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(withDiscoveryQuestions(project, next));
  };
  async function upload(file: File | undefined, assetType: "logo" | "background") {
    if (!file) return;
    if (assetType === "background" && !canEditCover) { setUploadError("A página inicial atual não usa uma seção de capa. Configure a página de presença no Avançado antes de enviar a imagem."); return; }
    setUploading(true); setUploadError("");
    try {
      const analyzed = assetType === "logo" ? await analyzeBrandFile(file) : null;
      const form = new FormData(); form.set("file", file); form.set("assetType", assetType); form.set("altText", assetType === "logo" ? `Logo de ${project.name}` : `Capa de ${project.name}`);
      const response = await fetch(`/api/projects/${project.id}/media`, { method: "POST", body: form });
      const payload = await response.json() as { data?: MediaAsset & { url?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível enviar a imagem.");
      setMedia((current) => [payload.data!, ...current]);
      if (assetType === "logo") {
        patch({ brand: { ...analyzed!, primaryLogoAssetId: payload.data.id, brandPersonality: project.brand.brandPersonality }, designSystem: { ...project.designSystem, colors: analyzed!.activePalette } });
      } else {
        setCover(payload.data.id, payload.data);
      }
    } catch (error) { setUploadError(error instanceof Error ? error.message : "Não foi possível enviar a imagem."); }
    finally { setUploading(false); }
  }
  function setCover(assetId: string, uploaded?: MediaAsset & { url?: string }) {
    if (!canEditCover || !project.presence) { setUploadError("A página inicial atual não usa uma capa. Configure a página de presença no Avançado."); return; }
    const asset = uploaded || media.find((item) => item.id === assetId);
    patch({ presence: { pages: project.presence.pages.map((page) => ({ ...page, sections: page.sections.map((section) => section.type === "hero" && page.isHome ? { ...section, style: { ...section.style, backgroundAssetId: assetId } } : section) })) }, mediaAssets: asset ? [...(project.mediaAssets || []).filter((item) => item.id !== asset.id), { ...asset, metadata: { ...asset.metadata, signedUrl: asset.url } }] : project.mediaAssets });
  }
  const card = (key: Section, title: string, summary: string, status: string, content: React.ReactNode) => <section key={key} className="rounded-2xl border border-[#dfe6ee] bg-white">
    <h2><button type="button" aria-expanded={open === key} aria-controls={`simple-${key}`} onClick={() => setOpen(open === key ? null : key)} className="focus-ring flex min-h-24 w-full items-center justify-between gap-4 rounded-2xl p-5 text-left sm:p-6">
      <span className="min-w-0"><span className="block text-lg font-extrabold text-[#07172f]">{title}</span><span className="mt-1 block text-sm text-[#526171]">{summary}</span><span className={`mt-2 block text-xs font-bold ${/revisar|configurar/i.test(status) ? "text-[#9a6700]" : "text-[#087756]"}`}>{status}</span></span>
      {open === key ? <ChevronUp className="shrink-0 text-[#0054fc]" size={20} /> : <ChevronDown className="shrink-0 text-[#0054fc]" size={20} />}
    </button></h2>
    <div id={`simple-${key}`} hidden={open !== key} className="border-t border-[#e8edf2] px-5 pb-6 pt-5 sm:px-6">{content}</div>
  </section>;
  const activeGoals = goals.filter((goal) => goal.isActive);
  const contextStatuses = contextDraft ? {
    confirmed: [...contextDraft.audienceContexts, ...contextDraft.offeringContexts, ...contextDraft.intentContexts, ...contextDraft.channelContexts].filter((item) => item.status === "confirmed").length,
    inferred: [...contextDraft.audienceContexts, ...contextDraft.offeringContexts, ...contextDraft.intentContexts, ...contextDraft.channelContexts].filter((item) => item.status === "inferred").length,
  } : null;
  return <div className="mt-7 space-y-3">
    {card("business", "Meu negócio", project.name || "Dê um nome ao negócio", activeGoals.length ? `${activeGoals.length} intenções ativas` : "Intenções a revisar", <>
      <p className="text-sm text-[#526171]">Conte o essencial. Um catálogo completo é opcional.</p>
      <div className="mt-4 space-y-4"><div><Label htmlFor="simple-name">Nome do negócio</Label><Input id="simple-name" value={project.name} onChange={(event) => patch({ name: event.target.value })} /></div><div><Label htmlFor="simple-description">Breve descrição</Label><Textarea id="simple-description" value={project.description} onChange={(event) => patch({ description: event.target.value })} /></div></div>
      <h3 className="mt-6 font-bold text-[#07172f]">O que os clientes procuram</h3>
      {goals.length ? <div className="mt-3 space-y-3">{goals.map((goal) => { const valid = project.steps.some((step) => step.id === goal.targetStepId && step.isActive); return <div key={goal.id} className="rounded-xl border border-[#e2e8ef] p-3"><Label htmlFor={`goal-${goal.id}`}>Nome da intenção</Label><Input id={`goal-${goal.id}`} value={goal.name} onChange={(event) => patch({ conversionGoals: project.conversionGoals?.map((item) => item.id === goal.id ? { ...item, name: event.target.value } : item) })} /><label className="mt-2 flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={goal.isActive} disabled={!valid && !goal.isActive} onChange={(event) => patch({ conversionGoals: project.conversionGoals?.map((item) => item.id === goal.id ? { ...item, isActive: event.target.checked } : item) })} />Mostrar esta intenção</label>{!valid ? <p className="text-xs text-amber-700">A etapa ligada a esta intenção não está disponível. Ajuste a jornada no Avançado antes de ativá-la.</p> : null}<div className="flex gap-2"><button type="button" disabled={goal.order === Math.min(...goals.map((item) => item.order))} onClick={() => { const index = goals.findIndex((item) => item.id === goal.id); if (index < 1) return; const previous = goals[index - 1]; patch({ conversionGoals: project.conversionGoals?.map((item) => item.id === goal.id ? { ...item, order: previous.order } : item.id === previous.id ? { ...item, order: goal.order } : item) }); }} className={actionClass}>Subir prioridade</button></div></div>; })}</div> : <p className="mt-2 text-sm text-[#526171]">Ainda não há intenções. A criação de uma jornada exige uma etapa válida no Avançado.</p>}
      <h3 className="mt-6 font-bold text-[#07172f]">O que a SOBE entendeu</h3>
      {contextDraft ? <><p className="mt-1 text-xs text-[#526171]">{contextStatuses?.confirmed} confirmados · {contextStatuses?.inferred} precisam confirmar. Ausências não são preenchidas por suposição.</p><div className="mt-3"><Label htmlFor="context-sells">Produtos ou serviços principais</Label><Textarea id="context-sells" value={contextDraft.summary.whatItSells} onChange={(event) => editContext({ ...contextDraft, summary: { ...contextDraft.summary, whatItSells: event.target.value } })} /></div><div className="mt-3 space-y-2">{contextDraft.intentContexts.map((intent) => <div key={intent.id} className="rounded-lg bg-[#f7f8fa] p-3 text-sm"><strong className="text-[#07172f]">{intent.label}</strong><span className="ml-2 text-xs text-[#526171]">{intent.status === "confirmed" ? "Confirmado" : intent.status === "inferred" ? "Precisa confirmar" : "Desatualizado"}</span>{intent.status === "inferred" ? <button type="button" onClick={() => editContext({ ...contextDraft, intentContexts: contextDraft.intentContexts.map((item) => item.id === intent.id ? { ...item, status: "confirmed", confidence: 1 } : item) })} className={`${actionClass} block`}>Confirmar esta informação</button> : null}</div>)}</div><p className="mt-2 text-xs text-[#526171]">Não informado: {contextDraft.summary.whatItSells.trim() ? "nenhuma descrição principal ausente" : "produtos ou serviços principais"}.</p><div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void saveContext()} disabled={!contextDirty || contextSaving}>{contextSaving ? "Salvando…" : "Salvar revisão"}</Button><span role="status" className="text-xs text-[#526171]">{contextDirty ? "Revisão não salva" : contextSaved ? "Revisão salva; página pública ainda não atualizada" : "Revisão independente do rascunho"}</span></div></> : <p className="mt-2 text-sm text-[#526171]">{contextError || "Nenhum contexto comercial registrado ainda."}</p>}
      {contextError && contextDraft ? <div className="mt-2"><p role="alert" className="text-sm text-red-700">{contextError}</p>{contextError.includes("mudou em outra tela") ? <button type="button" className={actionClass} onClick={() => { if (window.confirm("Recarregar a revisão mais recente e descartar somente as alterações locais do contexto?")) { void fetch(`/api/projects/${project.id}/commercial-context`).then((response) => response.json()).then((payload: { data?: ProjectCommercialContext }) => { if (payload.data) { setContext(payload.data); setContextDraft(payload.data); setContextDirty(false); onContextDirtyChange?.(false); setContextError(""); } }).catch(() => setContextError("Não foi possível recarregar. Tente novamente.")); } }}>Recarregar contexto para revisar</button> : null}</div> : null}
      <div className="mt-3 flex flex-wrap gap-4"><Link href={`${base}/sources`} className={actionClass}>Atualizar com material (opcional)</Link><Link href={`${base}/data`} className={actionClass}>Detalhar produtos (opcional)</Link></div>
    </>)}
    {card("service", "Como atender", primaryNumber?.label || "Escolha o atendimento", primaryNumber?.value ? "WhatsApp configurado" : "Destino a configurar", <>
      <Label htmlFor="simple-channel">Canal principal</Label><select id="simple-channel" value={requestedChannel} onChange={(event) => setRequestedChannel(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe6ee] bg-white px-3 text-sm"><option value="whatsapp">WhatsApp</option><option value="external">Link externo</option><option value="phone">Telefone</option><option value="email">Email</option></select>
      {requestedChannel === "whatsapp" ? <><p className="mt-3 text-sm text-[#526171]">O visitante decide se envia a mensagem.</p>{active ? <div className="mt-4"><WhatsAppNumbersEditor project={project} onChange={onChange} /></div> : null}</> : <p role="status" className="mt-4 rounded-xl bg-[#fff8e8] p-4 text-sm text-[#6d4c00]">Este canal só pode ser principal se a jornada pública estiver ligada a um destino válido. Configure e teste essa ligação em Destinos e unidades avançados; a escolha aqui não altera seu rascunho.</p>}
      <p className="mt-4 rounded-xl bg-[#f4f8ff] p-4 text-sm text-[#344150]">Simulação: a SOBE prepara o contato{primaryNumber?.value ? ` para ${primaryNumber.label}` : " para o número principal"}, sem enviar automaticamente.</p>
      <p className="mt-3 text-xs text-[#526171]">Outros canais exigem uma jornada pública compatível. Configure destinos específicos de unidades e intenções no Avançado.</p><Link href={`${base}/operations`} className={actionClass}>Destinos e unidades avançados</Link>
    </>)}
    {card("questions", "O que perguntar", questions.length ? `${questions.length} perguntas no atendimento` : "Sem perguntas atuais", questions.length >= 2 && questions.length <= 4 ? "Plano válido" : "Revisar plano", <>
      <p className="text-sm text-[#526171]">Edite as perguntas usadas no atendimento atual. O plano aceita de 2 a 4 perguntas.</p>
      {project.discoveryPlan && linkedQuestions ? <div className="mt-4 space-y-3">{questions.map((question, index) => <div key={question.id} className="rounded-xl border border-[#e2e8ef] p-3"><Label htmlFor={`question-${question.id}`}>Pergunta {index + 1}</Label><Input id={`question-${question.id}`} value={question.question} maxLength={240} onChange={(event) => updateQuestion(index, { question: event.target.value })} /><div className="mt-2 flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={question.required} onChange={(event) => updateQuestion(index, { required: event.target.checked })} />Obrigatória</label><button type="button" disabled={index === 0} onClick={() => moveQuestion(index, -1)} className={actionClass}>Subir</button><button type="button" disabled={index === questions.length - 1} onClick={() => moveQuestion(index, 1)} className={actionClass}>Descer</button><button type="button" disabled={questions.length <= 2} onClick={() => onChange(withDiscoveryQuestions(project, questions.filter((_, position) => position !== index)))} className={actionClass}>Remover</button></div></div>)}<button type="button" disabled={questions.length >= 4} onClick={() => onChange(withDiscoveryQuestions(project, [...questions, { id: crypto.randomUUID(), question: "Nova pergunta", type: "text", purpose: "context", required: false }]))} className={actionClass}>Adicionar pergunta</button>{!discoveryPlanSchema.safeParse(project.discoveryPlan).success ? <p role="alert" className="text-sm text-red-700">Revise o texto das perguntas. São necessárias de 2 a 4 perguntas válidas.</p> : null}</div> : <p className="mt-4 text-sm text-[#526171]">{project.discoveryPlan ? "O plano ainda não está ligado a uma etapa pública. Revise a jornada no Avançado antes de editar perguntas." : "Este projeto ainda não possui um plano de qualificação. Crie a jornada no Avançado antes de editar perguntas."}</p>}
      <p className="mt-4 rounded-xl bg-[#f7f8fa] p-4 text-sm text-[#344150]"><strong className="block">Simulação de briefing</strong>As respostas reais do visitante aparecerão aqui. Nenhum preço, disponibilidade ou preferência foi informado nesta simulação.</p>
    </>)}
    {card("appearance", "Aparência", project.brand.primaryLogoAssetId ? "Logo configurado" : "Identidade do negócio", cover ? "Capa configurada" : "Capa opcional", <>
      <p className="text-sm text-[#526171]">A prévia abaixo usa seu rascunho. A página publicada só muda após uma publicação explícita.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="simple-logo">Logo</Label><Input id="simple-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0], "logo")} /></div><div><Label htmlFor="simple-color">Cor principal</Label><Input id="simple-color" type="color" value={project.designSystem.colors.primary} onChange={(event) => { const palette = ensureAccessiblePalette({ ...project.designSystem.colors, primary: event.target.value }); patch({ designSystem: { ...project.designSystem, colors: palette }, brand: { ...project.brand, activePalette: palette } }); }} /></div><div className="sm:col-span-2"><Label htmlFor="simple-cover">Imagem de capa</Label><Input id="simple-cover" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0], "background")} />{media.filter((item) => item.mimeType.startsWith("image/") && item.assetType !== "logo").length ? <select aria-label="Escolher imagem já enviada" value={cover || ""} onChange={(event) => setCover(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe6ee] bg-white px-3 text-sm"><option value="" disabled>Escolher imagem já enviada</option>{media.filter((item) => item.mimeType.startsWith("image/") && item.assetType !== "logo").map((item) => <option key={item.id} value={item.id}>{item.altText || item.originalName}</option>)}</select> : null}</div></div>
      {!canEditCover ? <p className="mt-2 text-xs text-[#9a6700]">A página inicial atual usa uma jornada sem capa. Para mostrar uma imagem de destaque, configure uma página de presença no Avançado.</p> : null}
      {uploading ? <p role="status" className="mt-2 text-sm">Enviando imagem…</p> : null}{uploadError ? <p role="alert" className="mt-2 text-sm text-red-700">{uploadError} Tente novamente.</p> : null}
      <div className="mt-5 overflow-hidden rounded-xl border border-[#dfe6ee]"><p className="bg-[#f7f8fa] px-4 py-2 text-xs font-bold">Prévia do rascunho · ainda não publicada</p><div className="h-80 overflow-y-auto">{homePresencePage ? <PublicPresencePage project={project} page={homePresencePage} preview /> : <ExperienceCanvas project={project} preview />}</div></div>
    </>)}
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#dfe6ee] bg-white p-5"><Button type="button" onClick={onSave} disabled={saving || !dirty || Boolean(Object.keys(whatsappNumberErrors(projectWhatsAppNumbers(project))).length)}><Save size={16} aria-hidden="true" />{saving ? "Salvando…" : "Salvar rascunho"}</Button><span role="status" className="text-sm text-[#526171]">{saving ? "Salvando rascunho" : saved ? <span className="inline-flex items-center gap-1 text-[#087756]"><Check size={15} /> Rascunho salvo; página pública ainda não atualizada</span> : dirty ? "Alterações não salvas" : project.status === "published" ? "Rascunho salvo; alterações exigem publicação" : "Rascunho salvo; ainda não publicado"}</span>{saveError ? <p role="alert" className="w-full text-sm font-semibold text-red-600">{saveError}</p> : null}</div>
  </div>;
}
