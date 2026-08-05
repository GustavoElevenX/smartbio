"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
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
  onPublished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onPublished: (project: Project) => void;
}) {
  const [readiness, setReadiness] = useState<ProjectReadinessResult>();
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const request = useCallback(async (confirm: boolean) => {
    const response = await fetch(`/api/projects/${project.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectSnapshot: project, confirm }),
    });
    const payload = (await response.json()) as PublishResponse;
    if (!payload.data) {
      throw new Error(payload.error?.message || "Não foi possível validar a publicação.");
    }
    return payload.data;
  }, [project]);

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
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto rounded-[24px] border-[#dedce8] p-0">
        <DialogHeader className="border-b border-[#e8e6ed] px-6 py-5 pr-12">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold tracking-[-.03em]">
            <ShieldCheck className="text-[#6658d9]" size={22} />
            Revisão antes de publicar
          </DialogTitle>
          <DialogDescription>
            A SmartBio salva o rascunho, valida os dados e cria uma versão recuperável antes de colocar as alterações no ar.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm font-semibold text-[#666170]">
              <LoaderCircle className="animate-spin text-[#6658d9]" size={19} /> Validando projeto
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
                    {readiness.blocking.map((item) => (
                      <div key={item.key} className="rounded-[16px] border border-[#eadeda] p-4">
                        <strong className="block text-sm">{item.label}</strong>
                        <p className="mt-1 text-xs leading-5 text-[#74717b]">{item.reason}</p>
                        {item.actionPath ? <Link href={item.actionPath} onClick={() => onOpenChange(false)} className="mt-2 inline-flex text-xs font-extrabold text-[#6254d3]">{item.actionLabel || "Corrigir"} →</Link> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {readiness.warnings.length ? (
                <div className="mt-5 rounded-[18px] border border-[#eadfb8] bg-[#fffbed] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold"><AlertTriangle className="text-[#a87a16]" size={17} />Avisos que não impedem a publicação</h3>
                  <ul className="mt-3 grid gap-2 text-xs text-[#716a56]">
                    {readiness.warnings.map((item) => <li key={item.key}>• {item.label}: {item.reason}</li>)}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0ee] p-3 text-sm font-semibold text-[#b43e34]">{error}</p> : null}
        </div>

        <DialogFooter className="border-t border-[#e8e6ed] px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Continuar editando</Button>
          <Button disabled={!readiness?.publishable || publishing || loading} onClick={() => void publish()}>
            {publishing ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            {project.status === "published" ? "Publicar alterações" : "Publicar agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
