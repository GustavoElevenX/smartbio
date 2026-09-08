"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { AnalyticsEventName, Project } from "@/types";
import type { PresenceLaunchContext } from "@/features/presence/presence.types";

const ExperienceCanvas = dynamic(() => import("@/components/public-experience/public-experience").then((module) => module.ExperienceCanvas), { loading: () => <div role="status" className="grid min-h-[420px] place-items-center"><LoaderCircle className="animate-spin" /></div> });

interface LauncherValue { open(context: PresenceLaunchContext): void; track(name: AnalyticsEventName, metadata?: Record<string, unknown>): void }
const LauncherContext = createContext<LauncherValue | null>(null);
export function useConversionLauncher() { const value = useContext(LauncherContext); if (!value) throw new Error("PresenceAction precisa estar dentro de ConversionLauncher."); return value; }

function runtimeId(key: string) {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID(); sessionStorage.setItem(key, next); return next;
}

export function ConversionLauncher({ projectSlug, projectId, pageId, presentation = "overlay", previewProject, children }: { projectSlug: string; projectId: string; pageId: string; presentation?: "overlay" | "replace"; previewProject?: Project; children: ReactNode }) {
  const [context, setContext] = useState<PresenceLaunchContext>();
  const [project, setProject] = useState<Project | null>(previewProject || null);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [launchId, setLaunchId] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const preview = Boolean(previewProject);
  const track = useCallback((eventName: AnalyticsEventName, metadata: Record<string, unknown> = {}) => {
    if (preview) return;
    const payload = { projectId, visitorId: runtimeId(`virou:visitor:${projectId}`), sessionId: runtimeId(`virou:session:${projectId}`), eventName, conversionGoalId: metadata.goalId ? String(metadata.goalId) : undefined, activationId: metadata.activationId ? String(metadata.activationId) : undefined, benefitClaimId: metadata.benefitClaimId ? String(metadata.benefitClaimId) : undefined, presencePageId: String(metadata.pageId || pageId), presenceSectionId: metadata.sectionId ? String(metadata.sectionId) : undefined, metadata, referrer: document.referrer, deviceType: matchMedia("(max-width: 700px)").matches ? "mobile" : "desktop" };
    void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
  }, [pageId, preview, projectId]);
  const close = useCallback(() => { setContext(undefined); setComplete(false); setError(""); if (!preview && history.state?.virouConversion) history.back(); }, [preview]);
  const open = useCallback(async (next: PresenceLaunchContext) => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLaunchId((current) => current + 1);
    setContext({ ...next, pageId: next.pageId || pageId }); setComplete(false); setError("");
    track("presence_conversion_started", { ...next, pageId: next.pageId || pageId });
    if (!preview) history.pushState({ virouConversion: true }, "", `${location.pathname}${location.search}#converter`);
    if (project) return;
    try {
      const response = await fetch(`/api/public/projects/${encodeURIComponent(projectSlug)}/experience`);
      const payload = await response.json() as { data?: { project?: Project } };
      if (!response.ok || !payload.data?.project) throw new Error();
      setProject(payload.data.project);
    } catch { setError("Não foi possível iniciar agora. Tente novamente."); }
  }, [pageId, preview, project, projectSlug, track]);
  useEffect(() => { if (!preview) track("presence_page_viewed", { pageId }); }, [pageId, preview, track]);
  useEffect(() => { const onPop = () => { if (!location.hash.includes("converter")) { setContext(undefined); setComplete(false); } }; addEventListener("popstate", onPop); return () => removeEventListener("popstate", onPop); }, []);
  const value = useMemo(() => ({ open, track }), [open, track]);
  const visible = Boolean(context);
  return <LauncherContext.Provider value={value}>
    {presentation === "replace" && visible ? null : children}
    <Dialog open={visible} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }} className="max-h-[100dvh] w-full max-w-[760px] overflow-auto p-0 md:max-h-[92dvh]">
        <DialogTitle className="sr-only">Continuar atendimento</DialogTitle>
        {complete ? <div className="grid min-h-[420px] place-items-center p-8 text-center"><div><CheckCircle2 className="mx-auto size-12 text-emerald-600" /><h2 className="mt-4 text-2xl font-extrabold">{preview ? "Teste concluído." : "Recebemos suas informações."}</h2><p className="mt-2 text-sm text-slate-600">{preview ? "Esta é uma simulação. Nenhuma solicitação foi enviada." : "A equipe já pode continuar o atendimento com o contexto que você enviou."}</p><button type="button" onClick={close} className="mt-6 rounded-full bg-black px-5 py-3 font-bold text-white">Voltar ao site</button></div></div> : error ? <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><p className="font-bold">{error}</p><button type="button" onClick={close} className="mt-5 underline">Fechar</button></div></div> : project ? <ExperienceCanvas key={launchId} project={project} preview={preview} launchContext={context} onComplete={() => setComplete(true)} onClose={close} /> : <div role="status" className="grid min-h-[420px] place-items-center"><LoaderCircle className="animate-spin" /></div>}
      </DialogContent>
    </Dialog>
  </LauncherContext.Provider>;
}
