"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, MessagesSquare, PanelRight } from "lucide-react";
import { AIConversation, type InitialSetupForm } from "@/components/ai-setup/ai-conversation";
import { Button } from "@/components/ui/button";
import { aiSetupSessionSchema, type AISetupSession, type BrandIdentity, type SourceReference } from "@/features/ai-setup/ai-setup.schema";
import { forgetAISetupSession, readRememberedAISetupSession, rememberAISetupSession } from "@/features/ai-setup/ai-setup-state";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";
import type { VisitorActionSelection } from "@/features/ai-setup/visitor-actions";
import type { ActivationPreflight } from "@/features/ai-setup/activation-preflight";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";

const SetupPreview = dynamic(() => import("@/components/ai-setup/setup-preview"), { ssr: false });
const initialForm: InitialSetupForm = { businessName: "", description: "", websiteUrl: "", phone: "" };

async function apiCall<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const payload = await response.json() as { ok: boolean; data?: T; error?: { message?: string } };
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível continuar o onboarding.");
  return payload.data;
}

type AISetupShellProps = {
  startFresh?: boolean;
  initialPreflight: ActivationPreflight;
};

export function AISetupShell({ startFresh = false, initialPreflight }: AISetupShellProps) {
  const router = useRouter();
  const [form, setForm] = useState<InitialSetupForm>(initialForm);
  const [sources, setSources] = useState<SourceReference[]>([]);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity>();
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>();
  const [session, setSession] = useState<AISetupSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyQuestion, setBusyQuestion] = useState<string>();
  const [error, setError] = useState("");
  const [generationStatus, setGenerationStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [projectId, setProjectId] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"conversation" | "preview">("conversation");
  const [restoring, setRestoring] = useState(true);
  const [editingBusinessInfo, setEditingBusinessInfo] = useState(false);
  const [preflight, setPreflight] = useState(initialPreflight);
  const [phoneError, setPhoneError] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState("");

  function adopt(next: AISetupSession) {
    const parsed = aiSetupSessionSchema.parse(next);
    setSession(parsed);
    setForm({ businessName: parsed.initialInput.businessName, description: parsed.initialInput.description, websiteUrl: parsed.initialInput.websiteUrl || "", phone: parsed.initialInput.phone || "" });
    setSources(parsed.sources);
    setBrandIdentity(parsed.initialInput.brandIdentity);
    setProjectId(parsed.projectId);
    if (parsed.projectDraft) setGenerationStatus("ready");
    setEditingBusinessInfo(false);
    rememberAISetupSession(parsed);
  }

  useEffect(() => {
    let active = true;

    if (startFresh) {
      forgetAISetupSession();
      setRestoring(false);
      router.replace("/app/onboarding/ai");
      return () => { active = false; };
    }

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
  }, [router, startFresh]);

  async function analyze() {
    if (form.businessName.trim().length < 2 || form.description.trim().length < 15) {
      setError("Informe o nome do negócio e uma descrição com pelo menos 15 caracteres.");
      return;
    }
    const phone = validateSetupPhone(form.phone);
    if (!phone.valid) {
      setPhoneError(phone.error || "Confira o número informado.");
      return;
    }
    setPhoneError("");
    setBusy(true); setError("");
    try {
      const website = form.websiteUrl.trim();
      const websiteUrl = website.startsWith("@") ? `https://instagram.com/${website.slice(1)}` : website || undefined;
      const input = { requestedSurface: "recommend" as const, businessName: form.businessName.trim(), description: form.description.trim(), websiteUrl, phone: phone.normalized, brandIdentity };
      if (session && editingBusinessInfo) {
        adopt(await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/analyze`, { method: "POST", body: JSON.stringify({ input, sources }) }));
      } else {
        const created = await apiCall<AISetupSession>("/api/ai/setup/start", { method: "POST", body: JSON.stringify({ input, sources }) });
        adopt(created);
        adopt(await apiCall<AISetupSession>(`/api/ai/setup/${created.id}/analyze`, { method: "POST", body: "{}" }));
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível analisar o negócio."); }
    finally { setBusy(false); }
  }

  async function answer(key: string, value: string) {
    if (!session) return;
    setBusyQuestion(key); setError(""); setAnswerFeedback("");
    try {
      const currentKeys = new Set(session.questions.map((question) => question.key));
      const next = await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/answer`, { method: "POST", body: JSON.stringify({ key, value }) });
      const revealed = next.questions.filter((question) => question.key !== key && !currentKeys.has(question.key)).length;
      adopt(next);
      setAnswerFeedback(revealed
        ? `Salvo. Esta confirmação liberou ${revealed === 1 ? "mais 1 item necessário" : `mais ${revealed} itens necessários`} para revisar.`
        : "Salvo. A Sobe atualizou o que falta para criar sua primeira versão.");
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar a resposta."); }
    finally { setBusyQuestion(undefined); }
  }

  async function confirmActions(actions: VisitorActionSelection[]) {
    if (!session) return;
    setBusy(true); setError("");
    try { adopt(await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/actions`, { method: "POST", body: JSON.stringify({ actions }) })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível confirmar as ações."); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!session) return;
    setBusy(true); setError("");
    try {
      const latestPreflight = await apiCall<ActivationPreflight>("/api/ai/setup/preflight");
      setPreflight(latestPreflight);
      if (!latestPreflight.allowed) throw new Error(latestPreflight.blockedReason || "Não é possível criar uma nova versão agora.");
      setGenerationStatus("generating");
      const generatedSession = await apiCall<AISetupSession>(`/api/ai/setup/${session.id}/generate`, { method: "POST", body: "{}" });
      const project = generatedSession.projectDraft as Project | undefined;
      if (!project) throw new Error("A geração terminou sem criar um rascunho.");
      const saved = await projectRepository.saveProject(project);
      const finalized = await apiCall<{ session: AISetupSession }>(`/api/ai/setup/${session.id}/finalize-project`, { method: "POST", body: JSON.stringify({ projectId: saved.id, applyVerifiedFacts: true }) });
      adopt(finalized.session); setProjectId(saved.id); setGenerationStatus("ready");
      router.push(`/app/projects/${saved.id}/launch`);
    } catch (caught) { setGenerationStatus("idle"); setError(caught instanceof Error ? caught.message : "Não foi possível criar a primeira versão."); }
    finally { setBusy(false); }
  }

  if (!preflight.allowed) {
    return (
      <div className="animate-enter">
        <div className="mx-auto max-w-2xl border border-[#c8d9ea] bg-white p-7 shadow-[0_20px_65px_rgba(29,26,52,.07)] sm:p-10" style={{ clipPath: "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)" }}>
          <span className="grid size-12 place-items-center bg-[#eaf3ff] text-[#0054fc]"><LockKeyhole size={21} /></span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.12em] text-[#0054fc]">Verificação antes de começar</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#07172f]">Vamos continuar pelo caminho que seu plano permite.</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#526171]">{preflight.blockedReason}</p>
          <p className="mt-3 text-xs text-[#778595]">Nenhuma análise ou geração foi iniciada, então você não investe tempo em um fluxo que seria bloqueado no final.</p>
          <Link href={preflight.actionPath || "/app/settings/billing"} className="focus-ring mt-7 inline-flex min-h-12 items-center gap-2 bg-[#0054fc] px-5 text-sm font-extrabold text-white hover:bg-[#0186fc]">{preflight.actionLabel || "Ver meu plano"} <ArrowRight size={16} /></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-enter">
      <div className="mb-5"><h2 className="text-xl font-extrabold tracking-[-.03em] text-[#07172f]">Novo negócio</h2><p className="mt-1 text-sm text-[#687582]">Da descrição à primeira versão pronta para testar.</p></div>
      <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#e9e7ef] p-1 lg:hidden"><Button type="button" size="sm" variant={mobilePanel === "conversation" ? "primary" : "ghost"} onClick={() => setMobilePanel("conversation")}><MessagesSquare data-icon size={15} /> Conversa</Button><Button type="button" size="sm" variant={mobilePanel === "preview" ? "primary" : "ghost"} onClick={() => setMobilePanel("preview")}><PanelRight data-icon size={15} /> Prévia</Button></div>
      <div className="overflow-hidden rounded-[28px] border border-[#e3e1e9] bg-white shadow-[0_20px_65px_rgba(29,26,52,.07)] lg:grid lg:min-h-[720px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className={mobilePanel === "conversation" ? "block" : "hidden lg:block"}><AIConversation form={form} sources={sources} brandIdentity={brandIdentity} logoPreviewUrl={logoPreviewUrl} session={session} busy={busy || restoring} busyQuestion={busyQuestion} generationStatus={generationStatus} projectId={projectId} error={error} phoneError={phoneError} answerFeedback={answerFeedback} editingBusinessInfo={editingBusinessInfo} onFormChange={(next) => { setForm(next); if (next.phone !== form.phone) setPhoneError(""); }} onSourcesChange={setSources} onBrandIdentityChange={(brand, previewUrl) => { setBrandIdentity(brand); setLogoPreviewUrl(previewUrl); }} onAnalyze={analyze} onEditBusinessInfo={() => { setEditingBusinessInfo(true); setError(""); }} onAnswer={answer} onConfirmActions={confirmActions} onGenerate={generate} onOpenLaunch={() => projectId && router.push(`/app/projects/${projectId}/launch`)} /></div>
        <div className={mobilePanel === "preview" ? "block" : "hidden lg:block"}><SetupPreview session={session} businessName={form.businessName} description={form.description} brandIdentity={brandIdentity} logoPreviewUrl={logoPreviewUrl} /></div>
      </div>
    </div>
  );
}
