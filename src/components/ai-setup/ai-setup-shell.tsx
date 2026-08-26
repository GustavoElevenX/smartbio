"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  MessagesSquare,
  PanelRight,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import {
  AIConversation,
  type InitialSetupForm,
} from "@/components/ai-setup/ai-conversation";
import type { GenerationPhase } from "@/components/ai-setup/generation-status";
import { Button } from "@/components/ui/button";
import {
  aiSetupSessionSchema,
  type AISetupSession,
  type BrandIdentity,
  type CommercialArchitecture,
  type SourceReference,
} from "@/features/ai-setup/ai-setup.schema";
import {
  forgetAISetupSession,
  readRememberedAISetupSession,
  rememberAISetupDraft,
  rememberAISetupSession,
  type AISetupDraft,
} from "@/features/ai-setup/ai-setup-state";
import {
  hasConfirmedSetupPhone,
  hasRelevantSetupInformation,
  type AISetupLifecycleState,
} from "@/features/ai-setup/session-lifecycle";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";
import type { ActivationPreflight } from "@/features/ai-setup/activation-preflight";
import { validateSetupPhone } from "@/features/ai-setup/setup-phone";

const SetupPreview = dynamic(
  () => import("@/components/ai-setup/setup-preview"),
  { ssr: false },
);
const initialForm: InitialSetupForm = {
  businessName: "",
  description: "",
  websiteUrl: "",
  phone: "",
};

class SetupClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function apiCall<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.ok || payload.data === undefined)
    throw new SetupClientError(
      payload.error?.message || "Não foi possível continuar o onboarding.",
      response.status,
      payload.error?.code,
    );
  return payload.data;
}

function sessionForm(session: AISetupSession): InitialSetupForm {
  return {
    businessName: session.initialInput.businessName,
    description: session.initialInput.description,
    websiteUrl: session.initialInput.websiteUrl || "",
    phone: session.initialInput.phone || "",
  };
}

function draftSignature(form: InitialSetupForm, brandIdentity?: BrandIdentity) {
  return JSON.stringify({ form, brandSourceId: brandIdentity?.sourceId });
}

function isInvalidSessionError(error: unknown) {
  return (
    error instanceof SetupClientError &&
    (error.status === 404 || error.code === "onboarding_session_not_found")
  );
}

type AISetupShellProps = {
  startFresh?: boolean;
  initialPreflight: ActivationPreflight;
  workspaceId: string;
};

export function AISetupShell({
  startFresh = false,
  initialPreflight,
  workspaceId,
}: AISetupShellProps) {
  const router = useRouter();
  const [form, setForm] = useState<InitialSetupForm>(initialForm);
  const [sources, setSources] = useState<SourceReference[]>([]);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity>();
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>();
  const [session, setSession] = useState<AISetupSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyQuestion, setBusyQuestion] = useState<string>();
  const [error, setError] = useState("");
  const [generationStatus, setGenerationStatus] = useState<GenerationPhase>("idle");
  const [projectId, setProjectId] = useState<string>();
  const [mobilePanel, setMobilePanel] = useState<"conversation" | "preview">(
    "conversation",
  );
  const [editingBusinessInfo, setEditingBusinessInfo] = useState(false);
  const [preflight, setPreflight] = useState(initialPreflight);
  const [phoneError, setPhoneError] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState("");
  const [lifecycle, setLifecycle] =
    useState<AISetupLifecycleState>("initializing");
  const [resumed, setResumed] = useState(false);
  const [recoverableDraft, setRecoverableDraft] =
    useState<AISetupDraft>();
  const lastSavedDraft = useRef("");
  const draftVersion = useRef(0);

  const adopt = useCallback(
    (next: AISetupSession, draft?: AISetupDraft) => {
      draftVersion.current += 1;
      const parsed = aiSetupSessionSchema.parse(next);
      const nextForm =
        parsed.status === "collecting" && draft ? draft : sessionForm(parsed);
      lastSavedDraft.current = draftSignature(
        sessionForm(parsed),
        parsed.initialInput.brandIdentity,
      );
      setSession(parsed);
      setForm(nextForm);
      setSources(parsed.sources);
      setBrandIdentity(parsed.initialInput.brandIdentity);
      setProjectId(parsed.projectId);
      setGenerationStatus(parsed.projectDraft ? "ready" : "idle");
      setEditingBusinessInfo(false);
      rememberAISetupSession(parsed, nextForm);
    },
    [],
  );

  const invalidateSession = useCallback(
    (draft?: AISetupDraft) => {
      draftVersion.current += 1;
      forgetAISetupSession();
      setRecoverableDraft(draft);
      setSession(null);
      setProjectId(undefined);
      setGenerationStatus("idle");
      setEditingBusinessInfo(false);
      setError("");
      setLifecycle("invalid_session");
    },
    [],
  );

  useEffect(() => {
    let active = true;

    async function createInitialSession(
      reason: "new" | "recovered" | "restarted",
      draft?: AISetupDraft,
    ) {
      const created = await apiCall<AISetupSession>(
        "/api/ai/setup/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            reason,
          }),
        },
      );
      if (!active) return;
      adopt(created, draft);
      if (draft) {
        const saved = await apiCall<AISetupSession>(
          `/api/ai/setup/${created.id}`,
          { method: "PATCH", body: JSON.stringify(draft) },
        );
        if (!active) return;
        adopt(saved, draft);
      }
      setLifecycle("active");
    }

    async function bootstrap() {
      setLifecycle("initializing");
      if (startFresh) {
        forgetAISetupSession();
        await createInitialSession("new");
        if (active) window.history.replaceState(null, "", "/app/onboarding/ai");
        return;
      }

      const remembered = readRememberedAISetupSession(workspaceId);
      if (remembered) {
        try {
          const validated = await apiCall<AISetupSession>(
            `/api/ai/setup/${remembered.sessionId}`,
          );
          if (!active) return;
          adopt(
            validated,
            !remembered.legacy && validated.status === "collecting"
              ? remembered.draft
              : undefined,
          );
          setResumed(hasRelevantSetupInformation(validated));
          setLifecycle(
            validated.status === "completed" ? "completed" : "active",
          );
          return;
        } catch (caught) {
          if (isInvalidSessionError(caught)) {
            if (active) invalidateSession(remembered.draft);
            return;
          }
          throw caught;
        }
      }

      const activeResult = await apiCall<{ session: AISetupSession | null }>(
        "/api/ai/setup/active",
      );
      if (!active) return;
      if (activeResult.session) {
        adopt(activeResult.session);
        setResumed(hasRelevantSetupInformation(activeResult.session));
        setLifecycle(
          activeResult.session.status === "completed" ? "completed" : "active",
        );
        return;
      }
      await createInitialSession("new");
    }

    void bootstrap().catch((caught) => {
      if (!active) return;
      setLifecycle("idle");
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível iniciar a configuração.",
      );
    });
    return () => {
      active = false;
    };
  }, [adopt, invalidateSession, router, startFresh, workspaceId]);

  useEffect(() => {
    if (!session || session.status !== "collecting" || busy) return;
    const signature = draftSignature(form, brandIdentity);
    if (signature === lastSavedDraft.current) return;
    const version = draftVersion.current;
    rememberAISetupDraft(session, form);
    const timer = window.setTimeout(() => {
      setLifecycle("saving");
      void apiCall<AISetupSession>(`/api/ai/setup/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          requestedSurface: "recommend",
          businessName: form.businessName,
          description: form.description,
          websiteUrl: form.websiteUrl || undefined,
          phone: form.phone || undefined,
          brandIdentity,
        }),
      })
        .then((saved) => {
          if (version !== draftVersion.current) return;
          lastSavedDraft.current = signature;
          adopt(saved, form);
          setLifecycle("active");
        })
        .catch((caught) => {
          if (isInvalidSessionError(caught)) invalidateSession(form);
          else {
            setLifecycle("active");
            setError(
              caught instanceof Error
                ? caught.message
                : "Não foi possível salvar o rascunho.",
            );
          }
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [adopt, brandIdentity, busy, form, invalidateSession, session]);

  async function createNewSession(
    reason: "recovered" | "restarted",
    draft?: AISetupDraft,
  ) {
    setLifecycle("recovering");
    setBusy(true);
    setError("");
    forgetAISetupSession();
    try {
      const created = await apiCall<AISetupSession>(
        "/api/ai/setup/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            reason,
          }),
        },
      );
      adopt(created, draft);
      if (draft) {
        const saved = await apiCall<AISetupSession>(
          `/api/ai/setup/${created.id}`,
          { method: "PATCH", body: JSON.stringify(draft) },
        );
        adopt(saved, draft);
      }
      setRecoverableDraft(undefined);
      setResumed(false);
      setLifecycle("active");
    } catch (caught) {
      setLifecycle("invalid_session");
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível começar uma nova configuração.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    if (
      hasRelevantSetupInformation(session) &&
      !window.confirm(
        "Começar novamente? O rascunho atual deixará de ser usado, sem afetar páginas ou projetos existentes.",
      )
    )
      return;
    await createNewSession("restarted");
  }

  function recoverFromInvalid(reuse: boolean) {
    void createNewSession(
      "recovered",
      reuse ? recoverableDraft : undefined,
    );
  }

  function ensureActiveSession() {
    if (
      session &&
      ["active", "saving", "analyzing", "generating"].includes(lifecycle)
    )
      return true;
    invalidateSession(form);
    return false;
  }

  async function analyze() {
    if (!ensureActiveSession()) return;
    if (
      form.businessName.trim().length < 2 ||
      form.description.trim().length < 15
    ) {
      setError(
        "Informe o nome do negócio e uma descrição com pelo menos 15 caracteres.",
      );
      return;
    }
    const phone = validateSetupPhone(form.phone);
    if (!phone.valid) {
      setPhoneError(phone.error || "Confira o número informado.");
      return;
    }
    setPhoneError("");
    draftVersion.current += 1;
    setBusy(true);
    setLifecycle("analyzing");
    setError("");
    try {
      const website = form.websiteUrl.trim();
      const websiteUrl = website.startsWith("@")
        ? `https://instagram.com/${website.slice(1)}`
        : website || undefined;
      const input = {
        requestedSurface: "recommend" as const,
        businessName: form.businessName.trim(),
        description: form.description.trim(),
        websiteUrl,
        phone: phone.normalized,
        brandIdentity,
      };
      const next = await apiCall<AISetupSession>(
        `/api/ai/setup/${session!.id}/analyze`,
        { method: "POST", body: JSON.stringify({ input, sources }) },
      );
      adopt(next);
      setLifecycle("active");
    } catch (caught) {
      if (isInvalidSessionError(caught)) invalidateSession(form);
      else {
        setLifecycle("active");
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível analisar o negócio.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function answer(key: string, value: unknown) {
    if (!ensureActiveSession()) return;
    setBusyQuestion(key);
    setLifecycle("saving");
    setError("");
    setAnswerFeedback("");
    try {
      const currentKeys = new Set(
        session!.questions.map((question) => question.key),
      );
      const next = await apiCall<AISetupSession>(
        `/api/ai/setup/${session!.id}/answer`,
        { method: "POST", body: JSON.stringify({ key, value }) },
      );
      const revealed = next.questions.filter(
        (question) =>
          question.key !== key && !currentKeys.has(question.key),
      ).length;
      adopt(next);
      setAnswerFeedback(
        revealed
          ? `Salvo. Esta confirmação liberou ${
              revealed === 1
                ? "mais 1 item necessário"
                : `mais ${revealed} itens necessários`
            } para revisar.`
          : "Salvo. A Sobe atualizou o que falta para criar sua primeira versão.",
      );
      setLifecycle("active");
    } catch (caught) {
      if (isInvalidSessionError(caught)) invalidateSession(form);
      else {
        setLifecycle("active");
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível salvar a resposta.",
        );
      }
    } finally {
      setBusyQuestion(undefined);
    }
  }

  async function confirmArchitecture() {
    if (!ensureActiveSession()) return;
    setBusy(true);
    setLifecycle("saving");
    setError("");
    try {
      adopt(
        await apiCall<AISetupSession>(
          `/api/ai/setup/${session!.id}/architecture`,
          { method: "POST", body: "{}" },
        ),
      );
      setLifecycle("active");
    } catch (caught) {
      if (isInvalidSessionError(caught)) invalidateSession(form);
      else {
        setLifecycle("active");
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível confirmar a interpretação.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function updateArchitecture(architecture: CommercialArchitecture) {
    if (!ensureActiveSession()) return;
    setBusy(true);
    setLifecycle("saving");
    setError("");
    try {
      adopt(await apiCall<AISetupSession>(`/api/ai/setup/${session!.id}/architecture`, { method: "PATCH", body: JSON.stringify({ architecture }) }));
      setLifecycle("active");
    } catch (caught) {
      if (isInvalidSessionError(caught)) invalidateSession(form);
      else {
        setLifecycle("active");
        setError(caught instanceof Error ? caught.message : "Não foi possível salvar os ajustes da interpretação.");
      }
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!ensureActiveSession()) return;
    setBusy(true);
    setLifecycle("generating");
    setError("");
    setGenerationStatus("checking");
    try {
      const latestPreflight = await apiCall<ActivationPreflight>(
        "/api/ai/setup/preflight",
      );
      setPreflight(latestPreflight);
      if (!latestPreflight.allowed)
        throw new Error(
          latestPreflight.blockedReason ||
            "Não é possível criar uma nova versão agora.",
        );
      setGenerationStatus("composing");
      const generatedSession = await apiCall<AISetupSession>(
        `/api/ai/setup/${session!.id}/generate`,
        { method: "POST", body: "{}" },
      );
      const project = generatedSession.projectDraft as Project | undefined;
      if (!project)
        throw new Error("A geração terminou sem criar um rascunho.");
      setGenerationStatus("saving");
      const saved = await projectRepository.saveProject(project);
      setGenerationStatus("finalizing");
      const finalized = await apiCall<{ session: AISetupSession }>(
        `/api/ai/setup/${session!.id}/finalize-project`,
        {
          method: "POST",
          body: JSON.stringify({
            projectId: saved.id,
            applyVerifiedFacts: true,
          }),
        },
      );
      adopt(finalized.session);
      setProjectId(saved.id);
      setGenerationStatus("ready");
      setLifecycle("completed");
      router.push(`/app/projects/${saved.id}/launch`);
    } catch (caught) {
      setGenerationStatus("idle");
      if (isInvalidSessionError(caught)) invalidateSession(form);
      else {
        setLifecycle("active");
        setError(
          caught instanceof Error
            ? caught.message
            : "Não foi possível criar a primeira versão.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  if (!preflight.allowed) {
    return (
      <div className="animate-enter">
        <div
          className="mx-auto max-w-2xl border border-[#c8d9ea] bg-white p-7 shadow-[0_20px_65px_rgba(29,26,52,.07)] sm:p-10"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)",
          }}
        >
          <span className="grid size-12 place-items-center bg-[#eaf3ff] text-[#0054fc]">
            <LockKeyhole size={21} />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[.12em] text-[#0054fc]">
            Verificação antes de começar
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em] text-[#07172f]">
            Vamos continuar pelo caminho que seu plano permite.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#526171]">
            {preflight.blockedReason}
          </p>
          <Link
            href={preflight.actionPath || "/app/settings/billing"}
            className="focus-ring mt-7 inline-flex min-h-12 items-center gap-2 bg-[#0054fc] px-5 text-sm font-extrabold text-white hover:bg-[#0186fc]"
          >
            {preflight.actionLabel || "Ver meu plano"} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  if (lifecycle === "initializing") {
    return (
      <div className="mx-auto max-w-2xl border border-[#dfe6ee] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-extrabold text-[#07172f]">
          Preparando uma configuração segura…
        </p>
        <p className="mt-2 text-xs text-[#687582]">
          Estamos confirmando seu rascunho antes de liberar as próximas ações.
        </p>
      </div>
    );
  }

  if (lifecycle === "invalid_session") {
    return (
      <div className="animate-enter">
        <div
          className="mx-auto max-w-2xl border border-[#f0d4b8] bg-white p-7 shadow-[0_20px_65px_rgba(29,26,52,.07)] sm:p-10"
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%)",
          }}
        >
          <span className="grid size-12 place-items-center bg-[#fff4e8] text-[#b45b16]">
            <TriangleAlert size={21} />
          </span>
          <h1 className="mt-6 text-3xl font-extrabold tracking-[-.04em] text-[#07172f]">
            Não conseguimos continuar este rascunho.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#526171]">
            Podemos começar uma nova configuração sem afetar suas páginas,
            projetos ou dados existentes.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => recoverFromInvalid(false)}
              disabled={busy}
            >
              Começar novamente <ArrowRight data-icon size={17} />
            </Button>
            {recoverableDraft &&
            (recoverableDraft.businessName || recoverableDraft.description) ? (
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => recoverFromInvalid(true)}
                disabled={busy}
              >
                Reaproveitar informações
              </Button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm font-semibold text-[#a33b35]">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const sessionReady = Boolean(
    session && ["active", "saving", "analyzing", "generating", "completed"].includes(lifecycle),
  );
  const phoneStatus = phoneError
    ? "invalid"
    : lifecycle === "saving" && form.phone
      ? "saving"
      : hasConfirmedSetupPhone(session, editingBusinessInfo)
        ? "saved"
        : "idle";

  return (
    <div className="animate-enter">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-[-.03em] text-[#07172f]">
            Novo negócio
          </h2>
          <p className="mt-1 text-sm text-[#687582]">
            Da descrição à primeira versão pronta para testar.
          </p>
        </div>
        {resumed && hasRelevantSetupInformation(session) ? (
          <div className="flex max-w-md items-center gap-3 border border-[#cfe0ff] bg-[#f3f7ff] px-4 py-3 text-xs text-[#40536a]">
            <span className="flex-1">
              <strong className="block text-[#07172f]">
                Configuração em andamento
              </strong>
              Continuando {session?.initialInput.businessName || "seu rascunho"}.
            </span>
            <button
              type="button"
              onClick={() => void restart()}
              className="focus-ring inline-flex shrink-0 items-center gap-1 font-extrabold text-[#0054fc]"
            >
              <RotateCcw size={14} /> Começar novamente
            </button>
          </div>
        ) : null}
      </div>
      <div className="mb-3 grid grid-cols-2 rounded-xl bg-[#e9e7ef] p-1 lg:hidden">
        <Button
          type="button"
          size="sm"
          variant={mobilePanel === "conversation" ? "primary" : "ghost"}
          onClick={() => setMobilePanel("conversation")}
        >
          <MessagesSquare data-icon size={15} /> Conversa
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mobilePanel === "preview" ? "primary" : "ghost"}
          onClick={() => setMobilePanel("preview")}
        >
          <PanelRight data-icon size={15} /> Prévia
        </Button>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-[#e3e1e9] bg-white shadow-[0_20px_65px_rgba(29,26,52,.07)] lg:grid lg:min-h-[720px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_370px]">
        <div
          className={
            mobilePanel === "conversation" ? "block" : "hidden lg:block"
          }
        >
          <AIConversation
            form={form}
            sources={sources}
            brandIdentity={brandIdentity}
            logoPreviewUrl={logoPreviewUrl}
            session={session}
            sessionReady={sessionReady}
            busy={busy}
            busyQuestion={busyQuestion}
            generationStatus={generationStatus}
            projectId={projectId}
            error={error}
            phoneError={phoneError}
            phoneStatus={phoneStatus}
            answerFeedback={answerFeedback}
            editingBusinessInfo={editingBusinessInfo}
            onFormChange={(update) => {
              draftVersion.current += 1;
              setForm((current) => {
                const next =
                  typeof update === "function" ? update(current) : update;
                if (next.phone !== current.phone) setPhoneError("");
                if (session) rememberAISetupDraft(session, next);
                return next;
              });
            }}
            onSourcesChange={setSources}
            onBrandIdentityChange={(brand, previewUrl) => {
              draftVersion.current += 1;
              setBrandIdentity(brand);
              setLogoPreviewUrl(previewUrl);
            }}
            onAnalyze={analyze}
            onEditBusinessInfo={() => {
              setEditingBusinessInfo(true);
              setError("");
            }}
            onAnswer={answer}
            onConfirmArchitecture={confirmArchitecture}
            onUpdateArchitecture={updateArchitecture}
            onGenerate={generate}
            onOpenLaunch={() =>
              projectId && router.push(`/app/projects/${projectId}/launch`)
            }
          />
        </div>
        <div
          className={
            mobilePanel === "preview" ? "block" : "hidden lg:block"
          }
        >
          <SetupPreview
            session={session}
            businessName={form.businessName}
            description={form.description}
            brandIdentity={brandIdentity}
            logoPreviewUrl={logoPreviewUrl}
          />
        </div>
      </div>
    </div>
  );
}
