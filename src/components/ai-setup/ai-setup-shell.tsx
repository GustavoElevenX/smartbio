"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, PanelRight } from "lucide-react";
import { AIConversation, type InitialSetupForm } from "@/components/ai-setup/ai-conversation";
import { Button } from "@/components/ui/button";
import { aiSetupSessionSchema, type AISetupSession, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { readRememberedAISetupSession, rememberAISetupSession } from "@/features/ai-setup/ai-setup-state";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";

const SetupPreview = dynamic(() => import("@/components/ai-setup/setup-preview"), { ssr: false });
const initialForm: InitialSetupForm = { businessName: "", description: "", websiteUrl: "", phone: "" };

async function apiCall<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json() as { ok: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível continuar o onboarding.");
  return payload.data;
}

export function AISetupShell() {
  const router = useRouter();
  const [form, setForm] = useState<InitialSetupForm>(initialForm);
  const [sources, setSources] = useState<SourceReference[]>([]);
  const [session, setSession] = useState<AISetupSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyQuestion, setBusyQuestion] = useState<string>();
  const [error, setError] = useState("");
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [projectId, setProjectId] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"conversation" | "preview">("conversation");
  const [restoring, setRestoring] = useState(true);

  function adopt(next: AISetupSession) {
    const parsed = aiSetupSessionSchema.parse(next);
    setSession(parsed);
    setForm({ businessName: parsed.initialInput.businessName, description: parsed.initialInput.description, websiteUrl: parsed.initialInput.websiteUrl || "", phone: parsed.initialInput.phone || "" });
    setSources(parsed.sources);
    setProjectId(parsed.projectId);
    if (parsed.projectDraft) setGenerationStatus("ready");
    rememberAISetupSession(parsed);
  }

  useEffect(() => {
    let active = true;
    const remembered = readRememberedAISetupSession();
    if (!remembered) {
      setRestoring(false);
      return () => { active = false; };
    }
    adopt(remembered);
    void apiCall<AISetupSession>(`/api/ai/setup/${remembered.id}`)
      .then((next) => { if (active) adopt(next); })
      .catch(() => undefined)
      .finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, []);

  async function analyze() {
    if (form.businessName.trim().length < 2 || form.description.trim().length < 15) {
      setError("Informe o nome do negócio e uma descrição com pelo menos 15 caracteres.");
      return;
    }
    setBusy(true); setError("");
    try {
      const created = await apiCall<AISetupSession>("/api/ai/setup/start", { method: "POST", body: JSON.stringify({ input: { businessName: form.businessName.trim(), description: form.description.trim(), websiteUrl: form.websiteUrl.trim() || undefined, phone: form.phone.trim() || undefined }, sources }) });
      adopt(created);
      adopt(await apiCall<AISetupSession>(`/api/ai/setup/${created.id}/analyze`, { method: "POST", body: "{}" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível analisar o negócio."); }
    finally { setBusy(false); }
  }

  async function answer(key: string, value: string) {
    if (!session) return;
    setBusyQuestion(key); setError("");
    try { adopt(await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/answer`, { method: "POST", body: JSON.stringify({ key, value }) })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar a resposta."); }
    finally { setBusyQuestion(undefined); }
  }

  async function generate() {
    if (!session) return;
    setBusy(true); setGenerationStatus("generating"); setError("");
    try {
      const generatedSession = await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/generate`, { method: "POST", body: "{}" });
      const project = generatedSession.projectDraft as Project | undefined;
      if (!project) throw new Error("A geração terminou sem criar um rascunho.");
      const saved = await projectRepository.saveProject(project);
      const finalized = await apiCall<{ session: AISetupSession }>(`/api/ai/setup/${session.id}/finalize-project`, { method: "POST", body: JSON.stringify({ projectId: saved.id, applyVerifiedFacts: true }) });
      adopt(finalized.session); setProjectId(saved.id); setGenerationStatus("ready");
    } catch (caught) { setGenerationStatus("idle"); setError(caught instanceof Error ? caught.message : "Não foi possível gerar a jornada."); }
    finally { setBusy(false); }
  }

  return (
    <div className="animate-enter">
      <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#6d5ef5]">Novo projeto · IA</p><h2 className="mt-1 text-xl font-extrabold tracking-[-.03em]">Onboarding adaptativo</h2></div><p className="hidden max-w-md text-right text-xs leading-5 text-[#7b7985] md:block">Funciona em modo local e usa Supabase/OpenAI automaticamente quando o ambiente estiver configurado.</p></div>
      <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#e9e7ef] p-1 lg:hidden"><Button type="button" size="sm" variant={mobilePanel === "conversation" ? "primary" : "ghost"} onClick={() => setMobilePanel("conversation")}><MessagesSquare data-icon size={15} /> Conversa</Button><Button type="button" size="sm" variant={mobilePanel === "preview" ? "primary" : "ghost"} onClick={() => setMobilePanel("preview")}><PanelRight data-icon size={15} /> Prévia</Button></div>
      <div className="overflow-hidden rounded-[28px] border border-[#e3e1e9] bg-white shadow-[0_20px_65px_rgba(29,26,52,.07)] lg:grid lg:min-h-[720px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className={mobilePanel === "conversation" ? "block" : "hidden lg:block"}><AIConversation form={form} sources={sources} session={session} busy={busy || restoring} busyQuestion={busyQuestion} generationStatus={generationStatus} projectId={projectId} error={error} onFormChange={setForm} onSourcesChange={setSources} onAnalyze={analyze} onAnswer={answer} onGenerate={generate} onOpenEditor={() => projectId && router.push(`/app/projects/${projectId}/editor`)} /></div>
        <div className={mobilePanel === "preview" ? "block" : "hidden lg:block"}><SetupPreview session={session} businessName={form.businessName} description={form.description} /></div>
      </div>
    </div>
  );
}
