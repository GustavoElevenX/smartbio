"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Globe2, LoaderCircle, Route, ShieldCheck, Target, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectReadinessResult } from "@/features/publishing/project-readiness";
import type { Project } from "@/types";
import { SurfaceViewMarker } from "@/components/product-lifecycle/surface-view-marker";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { localStore } from "@/lib/local-store";
import {
  projectPublication,
  projectWithPublication,
  type ProjectPublication,
} from "@/features/publishing/publication-target";

interface PublishResponse {
  data?: {
    published: boolean;
    readiness: ProjectReadinessResult;
    project: Project;
  };
  error?: { message?: string };
}

export function PublishReadinessModal({
  open,
  onOpenChange,
  project,
  selectedStepId,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  selectedStepId?: string;
  onPublished: (project: Project) => void;
}) {
  const [readiness, setReadiness] = useState<ProjectReadinessResult>();
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publication, setPublication] = useState<ProjectPublication>(() => projectPublication(project));
  const goals = (project.conversionGoals || [])
    .filter((goal) => goal.isActive)
    .toSorted((a, b) => a.order - b.order);
  const steps = project.steps
    .filter((step) => step.isActive)
    .toSorted((a, b) => a.order - b.order);
  const currentStep = steps.find((step) => step.id === selectedStepId);

  useEffect(() => {
    if (open) setPublication(projectPublication(project));
  }, [open, project]);

  const request = useCallback(async (confirm: boolean) => {
    const projectSnapshot = projectWithPublication(project, publication);
    const response = await fetch(`/api/projects/${project.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectSnapshot, publication, confirm }),
    });
    const payload = (await response.json()) as PublishResponse;
    if (!payload.data) {
      throw new Error(payload.error?.message || "Não foi possível validar a publicação.");
    }
    return payload.data;
  }, [project, publication]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    setReadiness(undefined);
    void request(false)
      .then((data) => setReadiness(data.readiness))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Falha ao validar."))
      .finally(() => setLoading(false));
  }, [open, request]);

  async function publish() {
    setPublishing(true);
    setError("");
    try {
      const data = await request(true);
      setReadiness(data.readiness);
      if (!data.published) return;
      if (canUseLocalStore()) localStore.saveProject(data.project);
      onPublished(data.project);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível publicar.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <SurfaceViewMarker surface="publish_readiness" projectId={project.id} /> : null}
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-[24px] border-[#dedce8] p-0">
        <DialogHeader className="border-b border-[#e8e6ed] px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold tracking-[-.03em]">
            <ShieldCheck className="text-[#0054fc]" size={22} />
            Revisão antes de publicar
          </DialogTitle>
          <DialogDescription>
            A Sobe salva o rascunho, valida os dados e cria uma versão recuperável antes de colocar as alterações no ar.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <section aria-labelledby="publication-home-title" className="mb-5">
            <h3 id="publication-home-title" className="text-sm font-extrabold text-[#07172f]">O que abre no link principal?</h3>
            <p className="mt-1 text-xs leading-5 text-[#706d78]">Você pode mudar essa escolha em uma próxima publicação sem alterar o conteúdo criado.</p>
            <div role="radiogroup" aria-label="Formato do link principal" className="mt-3 grid gap-2 md:grid-cols-2">
              {([
                { mode: "site" as const, icon: Globe2, title: "Site completo", description: "Abre a página com seções, navegação e chamadas para ação." },
                { mode: "journey" as const, icon: Route, title: "Experiência guiada", description: "Abre a jornada completa para o visitante escolher o objetivo." },
                { mode: "goal" as const, icon: Target, title: "Ação específica", description: "Abre direto em um caminho, como catálogo, pedido ou orçamento." },
                { mode: "step" as const, icon: FileText, title: "Página selecionada", description: currentStep ? `Abre em “${currentStep.title}” e mantém o restante da jornada conectado.` : "Abre diretamente em uma página da jornada, sem remover as próximas etapas." },
              ]).map(({ mode, icon: Icon, title, description }) => {
                const selected = publication.homeMode === mode;
                return (
                  <label key={mode} className={`grid cursor-pointer grid-cols-[24px_1fr] gap-x-3 rounded-[16px] border p-3 transition focus-within:ring-4 focus-within:ring-[#0054fc]/20 md:block md:min-h-28 md:p-4 ${selected ? "border-[#0054fc] bg-[#f1f6ff]" : "border-[#dedce8] bg-white hover:border-[#9abaff]"}`}>
                    <input
                      type="radio"
                      name="publication-home-mode"
                      value={mode}
                      checked={selected}
                      onChange={() => setPublication({
                        homeMode: mode,
                        ...(mode === "goal" ? { conversionGoalId: publication.conversionGoalId || goals.find((goal) => goal.isPrimary)?.id || goals[0]?.id } : {}),
                        ...(mode === "step" ? { initialStepId: selectedStepId || publication.initialStepId || steps[0]?.id } : {}),
                      })}
                      className="sr-only"
                    />
                    <Icon aria-hidden className={`row-span-2 mt-0.5 md:mt-0 ${selected ? "text-[#0054fc]" : "text-[#526171]"}`} size={20} />
                    <strong className="block text-sm text-[#07172f] md:mt-3">{title}</strong>
                    <span className="mt-1 block text-xs leading-5 text-[#626b77]">{description}</span>
                  </label>
                );
              })}
            </div>
            {publication.homeMode === "goal" ? (
              <label className="mt-3 block text-xs font-bold text-[#344150]">
                A experiência começa em
                <select
                  aria-label="A experiência começa em"
                  value={publication.conversionGoalId || ""}
                  onChange={(event) => setPublication({ homeMode: "goal", conversionGoalId: event.target.value || undefined })}
                  className="mt-2 min-h-11 w-full rounded-[12px] border border-[#cbcfd7] bg-white px-3 text-sm font-semibold text-[#07172f] focus:outline-none focus:ring-4 focus:ring-[#0054fc]/20"
                >
                  <option value="">Escolha uma ação</option>
                  {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
                </select>
              </label>
            ) : null}
            {publication.homeMode === "step" ? (
              <label className="mt-3 block text-xs font-bold text-[#344150]">
                Página que abre primeiro
                <select
                  aria-label="Página que abre primeiro"
                  value={publication.initialStepId || ""}
                  onChange={(event) => setPublication({ homeMode: "step", initialStepId: event.target.value || undefined })}
                  className="mt-2 min-h-11 w-full rounded-[12px] border border-[#cbcfd7] bg-white px-3 text-sm font-semibold text-[#07172f] focus:outline-none focus:ring-4 focus:ring-[#0054fc]/20"
                >
                  <option value="">Escolha uma página</option>
                  {steps.map((step) => <option key={step.id} value={step.id}>{step.title}</option>)}
                </select>
                <span className="mt-2 block font-normal leading-5 text-[#706d78]">Os botões dessa página continuam levando às próximas etapas da experiência.</span>
              </label>
            ) : null}
          </section>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-[#666170]">
              <LoaderCircle className="animate-spin text-[#0054fc]" size={19} /> Validando projeto
            </div>
          ) : null}

          {readiness ? (
            <>
              <div className={`rounded-[18px] border p-4 ${readiness.publishable ? "border-[#b9e4cf] bg-[#effaf4]" : "border-[#f0c7c0] bg-[#fff5f3]"}`}>
                <div className="flex items-start gap-3">
                  {readiness.publishable ? <CheckCircle2 className="shrink-0 text-[#14845d]" size={22} /> : <XCircle className="shrink-0 text-[#bf493c]" size={22} />}
                  <div>
                    <strong className="block text-sm">{readiness.publishable ? "Pronto para publicar" : `${readiness.blocking.length} bloqueio${readiness.blocking.length === 1 ? "" : "s"} precisa${readiness.blocking.length === 1 ? "" : "m"} de correção`}</strong>
                    <p className="mt-1 text-xs leading-5 text-[#706d78]">Completude verificada: {readiness.score}%.</p>
                  </div>
                </div>
              </div>

              {readiness.blocking.length ? (
                <div className="mt-5">
                  <h3 className="text-xs font-extrabold uppercase tracking-[.12em] text-[#9b4138]">Bloqueios</h3>
                  <div className="mt-2 grid gap-2">
                    {readiness.blocking.map((item, index) => (
                      <div key={`${item.key}:${index}`} className="rounded-[16px] border border-[#eadeda] p-4">
                        <strong className="block text-sm">{item.label}</strong>
                        <p className="mt-1 text-xs leading-5 text-[#74717b]">{item.reason}</p>
                        {item.actionPath ? <Link href={item.actionPath} onClick={() => onOpenChange(false)} className="mt-2 inline-flex text-xs font-extrabold text-[#0054fc]">{item.actionLabel || "Corrigir"} →</Link> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {readiness.warnings.length ? (
                <div className="mt-5 rounded-[18px] border border-[#eadfb8] bg-[#fffbed] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold"><AlertTriangle className="text-[#a87a16]" size={17} />Avisos que não impedem a publicação</h3>
                  <ul className="mt-3 grid gap-2 text-xs text-[#716a56]">
                    {readiness.warnings.map((item, index) => <li key={`${item.key}:${index}`}>• {item.label}: {item.reason}</li>)}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#b43e34]">{error}</p> : null}
        </div>

        <DialogFooter className="sticky bottom-0 z-10 border-t border-[#e8e6ed] bg-white px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Continuar editando</Button>
          <Button disabled={!readiness?.publishable || publishing || loading || (publication.homeMode === "goal" && !publication.conversionGoalId) || (publication.homeMode === "step" && !publication.initialStepId)} onClick={() => void publish()}>
            {publishing ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {project.status === "published" ? "Publicar alterações" : "Publicar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
