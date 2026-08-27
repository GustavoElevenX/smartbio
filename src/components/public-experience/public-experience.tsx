"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bike,
  BookOpen,
  Building2,
  CalendarCheck,
  Check,
  Compass,
  FileText,
  LineChart,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Share2,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BlockRendererView } from "@/components/public-experience/blocks/block-renderers";
import { qualifyLead } from "@/features/qualification/qualification-engine";
import { buildRecommendationHandoff } from "@/features/qualification/recommendation-handoff";
import { recommendService } from "@/features/qualification/recommendation-engine";
import { journeyModeForProject } from "@/features/qualification/recommendation-semantics";
import { selectNextQualificationQuestion } from "@/features/qualification/offer-intelligence";
import { calculateReservationTotal } from "@/features/reservations/reservation-engine";
import { resolveRoute } from "@/features/routing/routing-engine";
import { destinationMatchesCompletion, semanticJourneyRouteKey } from "@/features/routing/completion-destination";
import { buildJourneyHandoff } from "@/features/handoff/journey-handoff";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
} from "@/features/whatsapp/whatsapp";
import { localStore } from "@/lib/local-store";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn, uid } from "@/lib/utils";
import { backfillConversionGoals } from "@/features/conversion-goals/utils";
import { resolveEntryPoint } from "@/features/entry-points/resolve";
import { resolveAttribution } from "@/features/attribution/attribution";
import { readUtm } from "@/features/attribution/utm";
import { createOpportunity } from "@/server/opportunities/factory";
import type {
  AnalyticsEventName,
  Booking,
  CapabilityKey,
  FormField,
  JourneyRuntimeState,
  Lead,
  OrderRequest,
  Project,
  QuoteRequest,
  Reservation,
  StepOption,
} from "@/types";
import type { PresenceLaunchContext } from "@/features/presence/presence.types";
import type { JourneyCompletionType } from "@/features/ai-setup/ai-setup.schema";

const iconMap = {
  ShoppingBag,
  BookOpen,
  MapPin,
  Building2,
  Bike,
  Store,
  Target,
  LineChart,
  TrendingUp,
  MessageSquare,
  MessageCircle,
  CalendarCheck,
  FileText,
  Mail,
  Sparkles,
  Compass,
  ArrowUpRight,
};

function DynamicIcon({ name }: { name?: string }) {
  const Icon = iconMap[name as keyof typeof iconMap] || ArrowRight;
  return <Icon size={19} />;
}

function completionTypeFrom(value: unknown): JourneyCompletionType | undefined {
  return ["whatsapp", "external_url", "phone", "email", "native"].includes(String(value)) ? String(value) as JourneyCompletionType : undefined;
}

function emptyRuntime(project: Project): JourneyRuntimeState {
  const goals = backfillConversionGoals(project).filter(
    (goal) => goal.isActive,
  );
  return {
    visitorId: uid("visitor"),
    sessionId: uid("session"),
    currentStepId:
      (goals.length > 1
        ? "__conversion-goals"
        : project.steps
            .filter((step) => step.isActive)
            .toSorted((a, b) => a.order - b.order)[0]?.id) || "",
    answers: {},
    selectedOfferIds: [],
    cart: { items: [], totals: { subtotal: 0, total: 0, currency: "BRL" } },
  };
}

function shouldSubmitCommercialOperationRemotely() {
  return !canUseLocalStore() && isSupabaseConfigured();
}

type StoredJourneyRuntime = Partial<JourneyRuntimeState> & {
  navigationHistory?: string[];
};

function runtimeFromStorage(
  project: Project,
  preview: boolean,
  previewGoalId?: string,
  previewEntryKey?: string,
  launchContext?: PresenceLaunchContext,
) {
  const fallback = emptyRuntime(project);
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  if (previewGoalId) params.set("goal", previewGoalId);
  if (previewEntryKey) params.set("entry", previewEntryKey);
  const goals = backfillConversionGoals(project).filter(
    (goal) => goal.isActive,
  );
  const resolved = resolveEntryPoint(
    project.entryPoints || [],
    goals,
    project.steps,
    params.get("entry"),
  );
  const requestedGoalId =
    launchContext?.goalId || (preview ? params.get("goal") : undefined);
  const previewGoal = requestedGoalId
    ? goals.find((goal) => goal.id === requestedGoalId)
    : undefined;
  const directGoal =
    resolved.goal || previewGoal || (goals.length === 1 ? goals[0] : undefined);
  const attribution = {
    ...resolveAttribution({
      explicit: readUtm(params),
      entry: resolved.entry,
      referrer: document.referrer,
      conversionGoalId: directGoal?.id,
    }),
    presencePageId: launchContext?.pageId,
    presenceSectionId: launchContext?.sectionId,
  };
  const seededAnswers = Object.fromEntries(
    Object.entries({
      catalogItemId: launchContext?.catalogItemId,
      serviceId: launchContext?.serviceId,
      locationId: launchContext?.locationId,
    }).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;
  const direct = {
    ...fallback,
    currentStepId:
      resolved.step?.id || directGoal?.targetStepId || fallback.currentStepId,
    conversionGoalId: directGoal?.id,
    entryPointId: launchContext?.entryPointId || resolved.entry?.id,
    attribution,
    answers: seededAnswers,
  };
  if (preview) return direct;
  try {
    const raw = sessionStorage.getItem(`smartbio:journey:v3:${project.slug}`);
    if (!raw) return direct;
    const stored = JSON.parse(raw) as StoredJourneyRuntime;
    const storedRuntime = { ...stored };
    delete storedRuntime.navigationHistory;
    const merged = {
      ...direct,
      ...storedRuntime,
      cart: { ...fallback.cart, ...storedRuntime.cart },
      quoteDraft: storedRuntime.quoteDraft
        ? { ...storedRuntime.quoteDraft, attachments: [] }
        : undefined,
    };
    return resolved.entry || previewGoal || launchContext
      ? {
          ...merged,
          currentStepId: direct.currentStepId,
          conversionGoalId: direct.conversionGoalId,
          entryPointId: direct.entryPointId,
          attribution: direct.attribution,
          answers: direct.answers,
          selectedOfferIds: [],
          selectedLocationId: launchContext?.locationId,
          selectedResourceId: undefined,
          selectedSlot: undefined,
          selectedDateRange: undefined,
          guests: undefined,
          quoteDraft: undefined,
          recommendationKey: undefined,
          recommendationReason: undefined,
          recommendationConfidence: undefined,
          routeResult: undefined,
          idempotencyKeys: undefined,
          cart: fallback.cart,
        }
      : merged;
  } catch {
    return direct;
  }
}

function historyFromStorage(project: Project, preview: boolean) {
  if (typeof window === "undefined" || preview) return [];
  if (new URLSearchParams(window.location.search).has("entry")) return [];
  try {
    const raw = sessionStorage.getItem(`smartbio:journey:v3:${project.slug}`);
    if (!raw) return [];
    const stored = JSON.parse(raw) as StoredJourneyRuntime;
    return Array.isArray(stored.navigationHistory)
      ? stored.navigationHistory.filter((stepId) =>
          project.steps.some((step) => step.id === stepId && step.isActive),
        )
      : [];
  } catch {
    return [];
  }
}

function stringAnswers(answers: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : String(value ?? ""),
    ]),
  ) as Record<string, string>;
}

function FieldControl({
  field,
  value,
  onChange,
  onFocus,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
  onFocus: () => void;
}) {
  const style =
    "min-h-12 w-full rounded-[var(--input-radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm text-[var(--foreground)] outline-none transition focus:ring-4 focus:ring-[var(--primary)]/10";
  const stringValue = value === undefined ? "" : String(value);
  if (field.type === "select")
    return (
      <select
        aria-label={field.label}
        required={field.required}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        className={style}
      >
        <option value="">Selecione</option>
        {field.options?.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    );
  if (field.type === "radio")
    return (
      <div className="grid gap-2">
        {field.options?.map((item) => (
          <label
            key={item}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--input-radius)] border px-3.5 text-sm font-semibold",
              stringValue === item
                ? "border-[var(--primary)] bg-[var(--muted)]"
                : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            <input
              type="radio"
              name={field.id}
              value={item}
              checked={stringValue === item}
              onChange={() => onChange(item)}
              onFocus={onFocus}
              required={field.required}
              className="accent-[var(--primary)]"
            />
            {item}
          </label>
        ))}
      </div>
    );
  if (field.type === "checkbox")
    return (
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={value === true || value === "true"}
          onChange={(event) => onChange(event.target.checked)}
          onFocus={onFocus}
          className="mt-1 accent-[var(--primary)]"
        />
        <span>{field.placeholder || field.label}</span>
      </label>
    );
  if (field.type === "textarea")
    return (
      <textarea
        aria-label={field.label}
        required={field.required}
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        placeholder={field.placeholder}
        className={`${style} min-h-24 py-3`}
      />
    );
  if (field.type === "file")
    return (
      <input
        aria-label={field.label}
        type="file"
        required={field.required}
        onFocus={onFocus}
        className={style}
      />
    );
  const type = field.type === "phone" ? "tel" : field.type;
  return (
    <input
      aria-label={field.label}
      required={field.required}
      type={type}
      value={stringValue}
      min={field.type === "number" ? 0 : undefined}
      onChange={(event) =>
        onChange(
          field.type === "number"
            ? Number(event.target.value)
            : event.target.value,
        )
      }
      onFocus={onFocus}
      placeholder={field.placeholder}
      className={style}
    />
  );
}

export function ExperienceCanvas({
  project,
  preview = false,
  previewGoalId,
  previewEntryKey,
  launchContext,
  onComplete,
}: {
  project: Project;
  preview?: boolean;
  previewGoalId?: string;
  previewEntryKey?: string;
  launchContext?: PresenceLaunchContext;
  onComplete?: () => void;
  onClose?: () => void;
}) {
  const activeSteps = useMemo<import("@/types").JourneyStep[]>(() => {
    const goals = backfillConversionGoals(project)
      .filter((goal) => goal.isActive)
      .sort((a, b) => a.order - b.order);
    const steps = project.steps
      .filter((step) => step.isActive)
      .toSorted((a, b) => a.order - b.order);
    if (goals.length <= 1) return steps;
    return [
      {
        id: "__conversion-goals",
        type: "choice" as const,
        title: "O que você deseja fazer hoje?",
        description:
          "Escolha seu objetivo para seguir pelo caminho mais direto.",
        order: -1,
        isActive: true,
        blocks: [],
        formFields: [],
        options: goals.map((goal) => ({
          id: `goal-option-${goal.id}`,
          label: goal.name,
          description: goal.description,
          value: goal.kind,
          actionType: "go_to_step" as const,
          targetStepId: goal.targetStepId,
          conversionGoalId: goal.id,
        })),
      },
      ...steps,
    ];
  }, [project]);
  const [runtime, setRuntime] = useState<JourneyRuntimeState>(() =>
    runtimeFromStorage(
      project,
      preview,
      previewGoalId,
      previewEntryKey,
      launchContext,
    ),
  );
  const [history, setHistory] = useState<string[]>(() =>
    historyFromStorage(project, preview),
  );
  const [leadForm, setLeadForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [revealedQualificationFieldIds, setRevealedQualificationFieldIds] = useState<string[]>([]);
  const formStarted = useRef(false);
  const mediaFiles = useRef<File[]>([]);
  const reduceMotion = useReducedMotion();
  const step =
    activeSteps.find((item) => item.id === runtime.currentStepId) ||
    activeSteps[0];
  const stepIndex = Math.max(
    0,
    activeSteps.findIndex((item) => item.id === step?.id),
  );
  const palette = project.designSystem.colors;
  const journeyMode = journeyModeForProject(project);
  const hasRecommendationJourney = activeSteps.some((candidate) => candidate.type === "recommendation");
  const serviceRecommendation = useMemo(
    () => recommendService(runtime.answers, project.commercialConfig?.serviceOfferings || [], { journeyMode }),
    [journeyMode, project.commercialConfig?.serviceOfferings, runtime.answers],
  );
  const progressiveQualification = step?.type === "form"
    && step.settings?.progressiveQuestioning === true
    && hasRecommendationJourney;
  const qualificationFields = step?.formFields || [];
  const renderedFormFields = progressiveQualification
    ? qualificationFields.filter((field, index) => index === 0 || revealedQualificationFieldIds.includes(field.id))
    : qualificationFields;
  const hasMoreQualificationQuestions = progressiveQualification
    && renderedFormFields.length < qualificationFields.length;
  const canFinishQualificationEarly = serviceRecommendation.confidence === "clear"
    && serviceRecommendation.strongEvidence === true;
  const selectedRecommendation = project.commercialConfig?.serviceOfferings?.find(
    (offering) => offering.id === runtime.recommendationKey || offering.slug === runtime.recommendationKey,
  ) || serviceRecommendation.service;
  const hasMaterializedRecommendation = Array.isArray(step?.settings?.recommendationOfferIds);
  const displayedRecommendation = step?.type === "recommendation" && step.recommendation
    ? hasMaterializedRecommendation ? {
        ...step.recommendation,
        title: selectedRecommendation ? `${selectedRecommendation.name} pode fazer sentido` : serviceRecommendation.title,
        description: runtime.recommendationReason || serviceRecommendation.reason,
        label: serviceRecommendation.label,
        benefits: [
          ...(selectedRecommendation?.shortDescription || selectedRecommendation?.description
            ? [selectedRecommendation.shortDescription || selectedRecommendation.description || ""]
            : []),
          "A equipe pode confirmar se este é o melhor caminho.",
        ].filter(Boolean),
      } : step.recommendation
    : undefined;

  function emit(
    eventName: AnalyticsEventName,
    metadata?: Record<string, unknown>,
  ) {
    if (preview || !step) return;
    const params = new URLSearchParams(location.search);
    const payload = {
      projectId: project.id,
      visitorId: runtime.visitorId,
      sessionId: runtime.sessionId,
      eventName,
      conversionGoalId: runtime.conversionGoalId,
      activationId: launchContext?.activationId,
      benefitClaimId: launchContext?.benefitClaimId,
      entryPointId: runtime.entryPointId,
      presencePageId: runtime.attribution?.presencePageId,
      presenceSectionId: runtime.attribution?.presenceSectionId,
      destinationId: runtime.routeResult?.destination?.id,
      stepId: step.id,
      metadata,
      referrer: document.referrer,
      utmSource:
        runtime.attribution?.source || params.get("utm_source") || undefined,
      utmMedium:
        runtime.attribution?.medium || params.get("utm_medium") || undefined,
      utmCampaign:
        runtime.attribution?.campaign ||
        params.get("utm_campaign") ||
        undefined,
      utmContent:
        runtime.attribution?.content || params.get("utm_content") || undefined,
      utmTerm: runtime.attribution?.term || params.get("utm_term") || undefined,
      deviceType: matchMedia("(max-width: 700px)").matches
        ? "mobile"
        : "desktop",
    } as const;
    localStore.track(payload);
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (preview) return;
    try {
      const serializable = {
        ...runtime,
        navigationHistory: history,
        quoteDraft: runtime.quoteDraft
          ? {
              ...runtime.quoteDraft,
              attachments: runtime.quoteDraft.attachments.map(
                ({ id, name, mimeType, size }) => ({
                  id,
                  name,
                  mimeType,
                  size,
                }),
              ),
            }
          : undefined,
      };
      sessionStorage.setItem(
        `smartbio:journey:v3:${project.slug}`,
        JSON.stringify(serializable),
      );
    } catch {}
  }, [history, preview, project.slug, runtime]);

  useEffect(() => {
    if (!preview) {
      emit("page_view");
      emit("session_started");
      emit("journey_started");
      if (runtime.entryPointId) emit("entry_point_loaded");
      if (
        runtime.conversionGoalId &&
        runtime.currentStepId !== "__conversion-goals"
      )
        emit("conversion_goal_resolved");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!preview && step) {
      emit("step_viewed");
      if (step.type === "recommendation") emit("recommendation_viewed");
    }
  }, [runtime.currentStepId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (submitted) onComplete?.();
  }, [onComplete, submitted]);

  function updateAnswer(key: string, value: string | number | boolean) {
    setRuntime((current) => ({
      ...current,
      answers: { ...current.answers, [key]: value },
      quoteDraft: current.quoteDraft
        ? {
            ...current.quoteDraft,
            answers: { ...current.quoteDraft.answers, [key]: value },
          }
        : current.quoteDraft,
    }));
  }

  function go(target?: string) {
    if (!target || !step) return;
    setHistory((items) => [...items, step.id]);
    setRuntime((current) => ({ ...current, currentStepId: target }));
    setLeadForm(false);
    setSubmitted(false);
    setConfirmation("");
    setError("");
    setRevealedQualificationFieldIds([]);
  }

  function back() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((items) => items.slice(0, -1));
    setRuntime((current) => ({ ...current, currentStepId: previous }));
    setLeadForm(false);
    setError("");
    setConfirmation("");
  }

  function addLead(
    input: Partial<Lead>,
    capability?: CapabilityKey,
    commercialObjectId?: string,
  ) {
    const answers = stringAnswers(runtime.answers);
    const lead = localStore.addLead({
      projectId: project.id,
      projectName: project.name,
      sessionId: runtime.sessionId,
      name: String(runtime.answers.name || input.name || ""),
      email: String(runtime.answers.email || input.email || ""),
      phone: String(runtime.answers.phone || input.phone || ""),
      company: String(runtime.answers.company || input.company || ""),
      status: input.status || "new",
      source:
        new URLSearchParams(location.search).get("utm_source") || "direct",
      campaign:
        new URLSearchParams(location.search).get("utm_campaign") || undefined,
      recommendation: input.recommendation || runtime.recommendationKey,
      answers,
      score: input.score,
      qualificationBand: input.qualificationBand,
      qualificationReason: input.qualificationReason,
      commercialAction: capability,
      commercialObjectId,
      operationalStatus: input.operationalStatus,
      estimatedValue: input.estimatedValue,
      scheduledAt: input.scheduledAt,
      locationName: input.locationName,
    });
    void fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...lead,
        conversionGoalId: runtime.conversionGoalId,
        entryPointId: runtime.entryPointId,
        destinationId: runtime.routeResult?.destination?.id,
        attribution: runtime.attribution,
        honeypot: "",
      }),
    }).catch(() => undefined);
    return lead;
  }

  function addOpportunity(
    sourceType:
      "lead" | "quote" | "booking" | "order" | "reservation" | "routed_contact",
    sourceId: string,
    title: string,
    input: {
      summary?: string;
      estimatedValue?: number;
      currency?: string;
      destinationId?: string;
    } = {},
  ) {
    const opportunity = createOpportunity({
      workspaceId: project.workspaceId,
      projectId: project.id,
      projectName: project.name,
      sessionId: runtime.sessionId,
      sourceType,
      sourceId,
      title,
      conversionGoalId: runtime.conversionGoalId,
      entryPointId: runtime.entryPointId,
      destinationId: input.destinationId,
      attribution: runtime.attribution,
      visitorData: runtime.answers,
      summary: input.summary,
      estimatedValue: input.estimatedValue,
      currency: input.currency,
    });
    localStore.saveOpportunity({ ...opportunity, id: uid("opportunity") });
    emit("opportunity_created", { sourceType, sourceId });
  }

  async function submitCapability(capability: CapabilityKey, option?: StepOption) {
    setBusy(true);
    setError("");
    setConfirmation("");
    emit("capability_started", { capability });
    const idempotencyKey = runtime.idempotencyKeys?.[capability] || uid("idem");
    if (!runtime.idempotencyKeys?.[capability])
      setRuntime((current) => ({
        ...current,
        idempotencyKeys: {
          ...current.idempotencyKeys,
          [capability]: idempotencyKey,
        },
      }));
    try {
      if (capability === "quote") {
        const definition = project.commercialConfig?.quoteDefinition;
        if (!definition) throw new Error("Orçamento indisponível.");
        const request: QuoteRequest = {
          id: uid("quote"),
          projectId: project.id,
          sessionId: runtime.sessionId,
          idempotencyKey,
          status: "submitted",
          answers: runtime.answers,
          estimatedMin: runtime.quoteDraft?.estimatedMin,
          estimatedMax: runtime.quoteDraft?.estimatedMax,
          currency: definition.currency,
          attachments: runtime.quoteDraft?.attachments || [],
          createdAt: new Date().toISOString(),
        };
        localStore.saveQuoteRequest(request);
        let remoteId: string | undefined;
        if (shouldSubmitCommercialOperationRemotely()) {
          const response = await fetch("/api/public/quotes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...request,
              conversionGoalId: runtime.conversionGoalId,
              entryPointId: runtime.entryPointId,
              attribution: runtime.attribution,
              visitorData: {
                name: runtime.answers.name || "",
                phone: runtime.answers.phone || "",
                email: runtime.answers.email || "",
              },
              honeypot: "",
            }),
          });
          const payload = (await response.json()) as {
            data?: { request?: { id?: string } };
            error?: { message?: string };
          };
          if (!response.ok)
            throw new Error(
              payload.error?.message || "Não foi possível enviar o orçamento.",
            );
          remoteId = payload.data?.request?.id;
          if (remoteId && mediaFiles.current.length)
            await Promise.all(
              mediaFiles.current.map(async (file) => {
                const form = new FormData();
                form.set("file", file);
                await fetch(`/api/public/quotes/${remoteId}/attachments`, {
                  method: "POST",
                  body: form,
                });
              }),
            );
        }
        addLead(
          {
            operationalStatus: "orçamento enviado",
            estimatedValue: request.estimatedMax,
          },
          "quote",
          remoteId || request.id,
        );
        emit("quote_submitted", { quoteId: remoteId || request.id });
        addOpportunity(
          "quote",
          remoteId || request.id,
          `Orçamento · ${definition.title}`,
          {
            estimatedValue: request.estimatedMax || request.estimatedMin,
            currency: request.currency,
          },
        );
        setConfirmation(
          "Orçamento enviado. O negócio recebeu suas respostas e fotos.",
        );
      } else if (capability === "scheduling") {
        const service =
          project.commercialConfig?.schedulableServices?.find(
            (item) => item.id === runtime.answers.serviceId,
          ) || project.commercialConfig?.schedulableServices?.[0];
        if (!service || !runtime.selectedSlot)
          throw new Error("Escolha um serviço e um horário disponível.");
        const endsAt = String(
          runtime.answers.booking_ends_at ||
            new Date(
              new Date(runtime.selectedSlot).getTime() +
                service.durationMinutes * 60_000,
            ).toISOString(),
        );
        const booking: Booking = {
          id: uid("booking"),
          projectId: project.id,
          sessionId: runtime.sessionId,
          idempotencyKey,
          serviceId: service.id,
          resourceId: runtime.selectedResourceId,
          startsAt: runtime.selectedSlot,
          endsAt,
          status:
            service.confirmationMode === "instant" ? "confirmed" : "pending",
          confirmationMode: service.confirmationMode,
          visitorData: runtime.answers,
          createdAt: new Date().toISOString(),
        };
        localStore.saveBooking(booking);
        if (shouldSubmitCommercialOperationRemotely()) {
          const response = await fetch("/api/public/bookings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...booking,
              conversionGoalId: runtime.conversionGoalId,
              entryPointId: runtime.entryPointId,
              attribution: runtime.attribution,
              honeypot: "",
            }),
          });
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (!response.ok)
            throw new Error(
              payload.error?.message || "Não foi possível agendar.",
            );
        }
        addLead(
          { operationalStatus: booking.status, scheduledAt: booking.startsAt },
          "scheduling",
          booking.id,
        );
        emit("booking_submitted", { bookingId: booking.id });
        addOpportunity("booking", booking.id, `Agendamento · ${service.name}`, {
          summary: booking.startsAt,
        });
        if (booking.status === "confirmed")
          emit("booking_confirmed", { bookingId: booking.id });
        setConfirmation(
          booking.status === "confirmed"
            ? "Agendamento confirmado."
            : "Solicitação enviada para aprovação.",
        );
      } else if (capability === "catalog_order") {
        if (!runtime.cart.items.length)
          throw new Error("Adicione ao menos um item ao pedido.");
        const order: OrderRequest = {
          id: uid("order"),
          projectId: project.id,
          sessionId: runtime.sessionId,
          idempotencyKey,
          status: "submitted",
          fulfillment: runtime.cart.fulfillment || "pickup",
          locationId: runtime.selectedLocationId,
          items: runtime.cart.items,
          totals: runtime.cart.totals,
          visitorData: runtime.answers,
          createdAt: new Date().toISOString(),
        };
        localStore.saveOrder(order);
        if (shouldSubmitCommercialOperationRemotely()) {
          const response = await fetch("/api/public/orders", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...order,
              totals: undefined,
              conversionGoalId: runtime.conversionGoalId,
              entryPointId: runtime.entryPointId,
              activationId: launchContext?.activationId,
              benefitClaimCode: launchContext?.benefitClaimCode,
              attribution: runtime.attribution,
              honeypot: "",
            }),
          });
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (!response.ok)
            throw new Error(
              payload.error?.message || "Não foi possível enviar o pedido.",
            );
        }
        addLead(
          {
            operationalStatus: "pedido enviado",
            estimatedValue: order.totals.total,
          },
          "catalog_order",
          order.id,
        );
        emit("order_submitted", {
          orderId: order.id,
          total: order.totals.total,
        });
        addOpportunity(
          "order",
          order.id,
          `Pedido · ${order.items.length} item(ns)`,
          {
            estimatedValue: order.totals.total,
            currency: order.totals.currency,
          },
        );
        setConfirmation("Pedido enviado com sucesso.");
      } else if (capability === "reservation") {
        const range = runtime.selectedDateRange;
        const unitId = runtime.selectedOfferIds[0];
        const unit = project.commercialConfig?.reservableUnits?.find(
          (item) => item.id === unitId,
        );
        if (!range?.start || !range.end || !unit)
          throw new Error("Consulte as datas e escolha uma opção disponível.");
        const total = calculateReservationTotal(unit, range.start, range.end);
        const reservation: Reservation = {
          id: uid("reservation"),
          projectId: project.id,
          sessionId: runtime.sessionId,
          idempotencyKey,
          unitId,
          checkIn: range.start,
          checkOut: range.end,
          adults: runtime.guests?.adults || 2,
          children: runtime.guests?.children || 0,
          status:
            project.businessProfile?.confirmationMode === "instant"
              ? "confirmed"
              : "pending",
          total,
          depositAmount: project.commercialConfig?.paymentUrl
            ? Math.round(total * 0.3 * 100) / 100
            : undefined,
          visitorData: runtime.answers,
          createdAt: new Date().toISOString(),
        };
        localStore.saveReservation(reservation);
        if (shouldSubmitCommercialOperationRemotely()) {
          const response = await fetch("/api/public/reservations", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...reservation,
              conversionGoalId: runtime.conversionGoalId,
              entryPointId: runtime.entryPointId,
              attribution: runtime.attribution,
              honeypot: "",
            }),
          });
          const payload = (await response.json()) as {
            error?: { message?: string };
          };
          if (!response.ok)
            throw new Error(
              payload.error?.message || "Não foi possível solicitar a reserva.",
            );
        }
        addLead(
          { operationalStatus: reservation.status, estimatedValue: total },
          "reservation",
          reservation.id,
        );
        emit("reservation_submitted", { reservationId: reservation.id, total });
        addOpportunity(
          "reservation",
          reservation.id,
          `Reserva · ${unit.name}`,
          {
            estimatedValue: total,
            currency: unit.currency,
            summary: `${reservation.checkIn} → ${reservation.checkOut}`,
          },
        );
        if (reservation.status === "confirmed")
          emit("reservation_confirmed", { reservationId: reservation.id });
        setConfirmation(
          reservation.status === "confirmed"
            ? "Reserva confirmada."
            : "Solicitação de reserva enviada.",
        );
      } else if (capability === "routing") {
        const destinations =
          project.commercialConfig?.routingDestinations || [];
        const fallbackDestinationId = destinations.find((destination) => destination.isDefault && destination.role === "general_contact")?.id;
        const completionType = completionTypeFrom(option?.actionPayload?.completionType);
        const selectedLocationId = runtime.selectedLocationId || (typeof runtime.answers.location_id === "string" ? runtime.answers.location_id : undefined);
        const blueprintId = typeof option?.actionPayload?.blueprintId === "string" ? option.actionPayload.blueprintId : undefined;
        const routeContext = {
          ...runtime.answers,
          ...(selectedLocationId ? { location_id: selectedLocationId } : {}),
          ...(completionType ? { completion_type: completionType } : {}),
          ...(blueprintId && selectedLocationId ? { journey_route: semanticJourneyRouteKey(blueprintId, selectedLocationId) } : {}),
        };
        const result = resolveRoute(
          routeContext,
          project.commercialConfig?.routingRules || [],
          destinations,
          fallbackDestinationId,
          project.commercialConfig?.locations || [],
          completionType,
        );
        setRuntime((current) => ({
          ...current,
          routeResult: result,
          selectedLocationId: current.selectedLocationId || selectedLocationId,
        }));
        if (!preview) {
          await fetch("/api/public/routing/resolve", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              sessionId: runtime.sessionId,
              context: routeContext,
            }),
          }).catch(() => undefined);
        }
        emit(result.destination ? "route_resolved" : "route_unresolved", { ruleId: result.ruleId, destinationId: result.destination?.id, fallback: result.fallback, locationId: runtime.selectedLocationId });
        if (result.destination?.type === "whatsapp" && runtime.conversionGoalId)
          addOpportunity(
            "routed_contact",
            `${runtime.sessionId}:${result.destination.id}`,
            `Contato encaminhado · ${result.destination.label}`,
            { destinationId: result.destination.id, summary: result.reason },
          );
        if (!result.destination) throw new Error(`Não encontramos um destino ${completionType || "compatível"} seguro para a unidade selecionada. Revise a configuração antes de continuar.`);
        setConfirmation(`Destino encontrado: ${result.destination.label}.`);
      } else if (capability === "payment") {
        const paymentUrl = project.commercialConfig?.paymentUrl;
        if (!paymentUrl)
          throw new Error("O link de pagamento ainda não foi configurado.");
        emit("payment_started", { provider: "external" });
        if (!preview) window.open(paymentUrl, "_blank", "noopener,noreferrer");
        setConfirmation("Pagamento aberto em ambiente externo seguro.");
      }
      if (capability !== "qualification") setSubmitted(true);
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível concluir. Tente novamente.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function act(option: StepOption) {
    if (!step) return;
    emit("option_clicked", { optionId: option.id, value: option.value });
    if (option.conversionGoalId) {
      setRuntime((current) => ({
        ...current,
        ...(current.conversionGoalId !== option.conversionGoalId ? {
          answers: {},
          selectedOfferIds: [],
          selectedLocationId: undefined,
          selectedResourceId: undefined,
          selectedSlot: undefined,
          selectedDateRange: undefined,
          guests: undefined,
          cart: { items: [], totals: { subtotal: 0, total: 0, currency: "BRL" } },
          quoteDraft: undefined,
          recommendationKey: undefined,
          recommendationReason: undefined,
          recommendationConfidence: undefined,
          routeResult: undefined,
          idempotencyKeys: undefined,
        } : {}),
        conversionGoalId: option.conversionGoalId,
        attribution: current.attribution
          ? {
              ...current.attribution,
              conversionGoalId: option.conversionGoalId,
            }
          : current.attribution,
      }));
      emit("conversion_goal_selected", {
        conversionGoalId: option.conversionGoalId,
      });
    }
    if (
      step.type === "form" &&
      project.commercialConfig?.qualificationRules?.length
    ) {
      const result = qualifyLead(
        runtime.answers,
        project.commercialConfig.qualificationRules,
      );
      setRuntime((current) => ({
        ...current,
        recommendationKey: result.recommendationKey,
        answers: {
          ...current.answers,
          qualification_score: result.score,
          qualification_band: result.band,
          qualification_reason: result.reasons.join(" "),
        },
      }));
      emit("qualification_completed", {
        score: result.score,
        band: result.band,
      });
    }
    const targetStep = option.targetStepId
      ? project.steps.find((candidate) => candidate.id === option.targetStepId && candidate.isActive)
      : undefined;
    if (step.type === "form" && targetStep?.type === "recommendation") {
      const recommendation = recommendService(
        runtime.answers,
        project.commercialConfig?.serviceOfferings || [],
        { journeyMode },
      );
      setRuntime((current) => ({
        ...current,
        recommendationKey: recommendation.service?.id,
        recommendationReason: recommendation.reason,
        recommendationConfidence: recommendation.confidence,
        selectedOfferIds: recommendation.service
          ? [...new Set([...current.selectedOfferIds, recommendation.service.id])]
          : current.selectedOfferIds,
      }));
      emit("qualification_completed", { confidence: recommendation.confidence });
    }
    if (
      option.actionType === "go_to_step" ||
      option.actionType === "show_recommendation"
    )
      return go(option.targetStepId);
    if (option.actionType === "start_capability") {
      const completed = await submitCapability(
        String(option.actionPayload?.capability) as CapabilityKey,
        option,
      );
      if (completed && option.targetStepId) go(option.targetStepId);
      return;
    }
    if (option.actionType === "continue_with_answers") {
      const answeredFieldIds = (step.formFields || []).filter((field) => runtime.answers[field.key] !== undefined && runtime.answers[field.key] !== "").map((field) => field.id);
      for (const fieldId of answeredFieldIds) emit("journey_answered", { fieldId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
      emit("journey_context_completed", { blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId, conversionGoalId: runtime.conversionGoalId });
      return go(option.targetStepId);
    }
    if (option.actionType === "submit_form" || option.actionType === "capture_lead") {
      setLeadForm(true);
      return;
    }
    if (option.actionType === "open_whatsapp") {
      const destinations = project.commercialConfig?.routingDestinations || [];
      const completionType = completionTypeFrom(option.actionPayload?.completionType) || "whatsapp";
      let configuredDestination = destinations.find(
        (destination) => destination.id === option.actionPayload?.destinationId && destinationMatchesCompletion(destination, completionType),
      );
      if (option.actionPayload?.destinationId && !configuredDestination) {
        emit("route_unresolved", { destinationId: option.actionPayload.destinationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
        setError("O destino configurado não está mais disponível. O WhatsApp não foi aberto para evitar um encaminhamento incorreto.");
        return;
      }
      if (option.actionPayload?.routing === true) {
        const fallbackDestinationId = destinations.find((destination) => destination.isDefault && destination.role === "general_contact")?.id;
        const blueprintId = typeof option.actionPayload?.blueprintId === "string" ? option.actionPayload.blueprintId : undefined;
        const routeContext = {
          ...runtime.answers,
          ...(runtime.selectedLocationId ? { location_id: runtime.selectedLocationId } : {}),
          completion_type: completionType,
          ...(blueprintId && runtime.selectedLocationId ? { journey_route: semanticJourneyRouteKey(blueprintId, runtime.selectedLocationId) } : {}),
        };
        const result = resolveRoute(
          routeContext,
          project.commercialConfig?.routingRules || [],
          destinations,
          fallbackDestinationId,
          project.commercialConfig?.locations || [],
          completionType,
        );
        configuredDestination = destinationMatchesCompletion(result.destination, completionType) ? result.destination : undefined;
        if (!configuredDestination?.value) {
          emit("route_unresolved", { locationId: runtime.selectedLocationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
          setError("Não encontramos um WhatsApp seguro para a unidade selecionada. Revise a unidade antes de continuar.");
          return;
        }
        emit("route_resolved", { locationId: runtime.selectedLocationId, destinationId: configuredDestination.id, ruleId: result.ruleId, fallback: result.fallback });
        setRuntime((current) => ({ ...current, routeResult: result }));
      }
      const phone = String(configuredDestination?.value || option.actionPayload?.phone || (!option.actionPayload?.routing ? project.phone : "") || "");
      if (!phone) {
        emit("route_unresolved", { blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
        setError("O WhatsApp desta jornada não está configurado.");
        return;
      }
      emit("whatsapp_clicked", { destinationId: configuredDestination?.id || option.actionPayload?.destinationId, locationId: runtime.selectedLocationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
      const cart = runtime.cart.items.length
        ? `Pedido: ${runtime.cart.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}`
        : undefined;
      const recommendationFields = project.steps.flatMap((candidate) => candidate.formFields || []);
      const recommendationHandoff = hasRecommendationJourney
        ? buildRecommendationHandoff({
            answers: runtime.answers,
            fields: recommendationFields,
            serviceName: selectedRecommendation?.name,
            confidence: runtime.recommendationConfidence,
          })
        : { answers: stringAnswers(runtime.answers), closing: undefined };
      const handoffFields = project.steps.flatMap((candidate) => candidate.formFields || []);
      const selectedLocation = project.commercialConfig?.locations?.find((location) => location.id === runtime.selectedLocationId);
      const allOfferings = [...(project.commercialConfig?.serviceOfferings || []), ...(project.commercialConfig?.catalogItems || [])];
      const journeyHandoff = buildJourneyHandoff({
        intent: { label: String(option.actionPayload?.interestLabel || step.title) },
        answers: runtime.answers,
        fields: handoffFields,
        selectedLocation,
        selectedOfferings: allOfferings.filter((offering) => runtime.selectedOfferIds.includes(offering.id)),
      });
      let message = String(option.actionPayload?.message || "") || buildWhatsAppMessage({
        businessName: project.name,
        interest: journeyHandoff.interest,
        location: journeyHandoff.location,
        activation: launchContext?.activationId
          ? { name: "Ativação selecionada" }
          : undefined,
        benefitClaim: launchContext?.benefitClaimCode
          ? { code: launchContext.benefitClaimCode }
          : undefined,
        answers: {
          ...(Object.keys(journeyHandoff.answers).length ? journeyHandoff.answers : recommendationHandoff.answers),
          ...(cart ? { pedido: cart } : {}),
        },
        closing: recommendationHandoff.closing,
      });
      emit("handoff_built", { destinationId: configuredDestination?.id || option.actionPayload?.destinationId, locationId: runtime.selectedLocationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
      if (
        !preview &&
        launchContext?.activationId &&
        launchContext.benefitClaimId
      ) {
        await fetch(
          `/api/public/activations/${launchContext.activationId}/handoff`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              projectId: project.id,
              sessionId: runtime.sessionId,
              claimId: launchContext.benefitClaimId,
              idempotencyKey: `handoff:${runtime.sessionId}:${launchContext.benefitClaimId}`,
              destinationId:
                String(option.actionPayload?.destinationId || "") || undefined,
              locationId: runtime.selectedLocationId,
              entryPointId: runtime.entryPointId,
              presencePageId: launchContext.pageId,
              presenceSectionId: launchContext.sectionId,
              conversionGoalId: runtime.conversionGoalId,
            }),
          },
        );
      } else if (!preview) {
        const includedHandoffFields = project.steps
          .flatMap((candidate) => candidate.formFields || [])
          .filter((field) => field.includeInHandoff);
        const response = await fetch("/api/public/handoff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            sessionId: runtime.sessionId,
            destinationId:
              String(option.actionPayload?.destinationId || "") || undefined,
            context: {
              projectId: project.id,
              conversionGoalId: runtime.conversionGoalId,
              origin: {
                entryPointId: runtime.entryPointId,
                source: runtime.attribution?.source,
                campaign: runtime.attribution?.campaign,
                pageId: launchContext?.pageId,
              },
              identity: {
                name: String(runtime.answers.name || "") || undefined,
                phone: String(runtime.answers.phone || "") || undefined,
                email: String(runtime.answers.email || "") || undefined,
              },
              intent: {
                label: step.title,
                productIds: runtime.cart.items.map((item) => item.itemId),
                serviceIds: runtime.selectedOfferIds,
                locationId: runtime.selectedLocationId,
              },
              qualification: includedHandoffFields.map((field) => ({
                label: field.handoffLabel || field.label,
                value: String(runtime.answers[field.key] ?? ""),
                include: Boolean(
                  runtime.answers[field.key] !== undefined &&
                    runtime.answers[field.key] !== "",
                ),
              })),
              benefit: launchContext?.benefitClaimCode
                ? { code: launchContext.benefitClaimCode }
                : undefined,
            },
          }),
        });
        const payload = await response.json().catch(() => null) as { data?: { message?: string } } | null;
        if (response.ok && payload?.data?.message) message = payload.data.message;
      }
      if (!preview)
        window.open(
          buildWhatsAppUrl(phone, message),
          "_blank",
          "noopener,noreferrer",
        );
      return;
    }
    if (option.actionType === "open_url") {
      const destinations = project.commercialConfig?.routingDestinations || [];
      const completionType = completionTypeFrom(option.actionPayload?.completionType) || "external_url";
      let configuredDestination = option.actionPayload?.destinationId
        ? destinations.find((destination) => destination.id === option.actionPayload?.destinationId && destinationMatchesCompletion(destination, completionType))
        : undefined;
      if (option.actionPayload?.destinationId && !configuredDestination) {
        emit("route_unresolved", { destinationId: option.actionPayload.destinationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId });
        setError(`O destination ${completionType} configurado não está mais disponível.`);
        return;
      }
      if (option.actionPayload?.routing === true) {
        const fallbackDestinationId = destinations.find((destination) => destination.isDefault && destination.role === "general_contact")?.id;
        const blueprintId = typeof option.actionPayload?.blueprintId === "string" ? option.actionPayload.blueprintId : undefined;
        const routeContext = {
          ...runtime.answers,
          ...(runtime.selectedLocationId ? { location_id: runtime.selectedLocationId } : {}),
          completion_type: completionType,
          ...(blueprintId && runtime.selectedLocationId ? { journey_route: semanticJourneyRouteKey(blueprintId, runtime.selectedLocationId) } : {}),
        };
        const result = resolveRoute(routeContext, project.commercialConfig?.routingRules || [], destinations, fallbackDestinationId, project.commercialConfig?.locations || [], completionType);
        configuredDestination = destinationMatchesCompletion(result.destination, completionType) ? result.destination : undefined;
        if (!configuredDestination) {
          emit("route_unresolved", { locationId: runtime.selectedLocationId, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId, completionType });
          setError(`Não encontramos um destination ${completionType} seguro para a unidade selecionada.`);
          return;
        }
        emit("route_resolved", { locationId: runtime.selectedLocationId, destinationId: configuredDestination.id, ruleId: result.ruleId, fallback: result.fallback, completionType });
        setRuntime((current) => ({ ...current, routeResult: result }));
      }
      const destinationValue = configuredDestination?.value;
      const resolvedUrl = completionType === "phone" && destinationValue ? `tel:${destinationValue}` : completionType === "email" && destinationValue ? `mailto:${destinationValue}` : destinationValue || String(option.actionPayload?.url || "");
      if (!resolvedUrl) {
        setError("O destination desta jornada não está configurado.");
        return;
      }
      emit("external_url_clicked", { url: resolvedUrl, blueprintId: option.actionPayload?.blueprintId, intentId: option.actionPayload?.intentId, completionType });
      emit(
        option.value === "payment"
          ? "payment_started"
          : "external_link_clicked",
        { url: resolvedUrl },
      );
      if (!preview)
        window.open(
          resolvedUrl,
          "_blank",
          "noopener,noreferrer",
        );
      return;
    }
    if (option.actionType === "finish") {
      emit("journey_completed");
      setConfirmation("Jornada concluída.");
    }
  }

  function submitStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const option = step?.options?.[0];
    if (step?.type === "schedule" && !runtime.selectedSlot) {
      setError("Consulte e escolha um horário.");
      return;
    }
    if (progressiveQualification && hasMoreQualificationQuestions && !canFinishQualificationEarly) {
      const nextQuestion = selectNextQualificationQuestion({
        answers: runtime.answers,
        offerings: project.commercialConfig?.serviceOfferings || [],
        fields: qualificationFields,
        visibleFieldIds: renderedFormFields.map((field) => field.id),
      });
      if (!nextQuestion) {
        if (option) void act(option);
        return;
      }
      setRevealedQualificationFieldIds((ids) => [...new Set([...ids, nextQuestion.id])]);
      setError("");
      return;
    }
    if (option) void act(option);
  }

  function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = project.commercialConfig?.qualificationRules?.length
      ? qualifyLead(
          runtime.answers,
          project.commercialConfig.qualificationRules,
        )
      : undefined;
    const lead = addLead(
      {
        status: result?.band === "qualified" ? "qualified" : "new",
        score: result?.score,
        qualificationBand: result?.band,
        qualificationReason: result?.reasons.join(" "),
        recommendation: runtime.recommendationKey,
        operationalStatus: "lead capturado",
      },
      result ? "qualification" : undefined,
    );
    addOpportunity(
      "lead",
      lead.id,
      `Contato · ${lead.name || "Novo interesse"}`,
      { summary: runtime.recommendationKey },
    );
    emit("form_submitted");
    emit("lead_captured");
    emit("journey_completed");
    setSubmitted(true);
    setLeadForm(false);
    setConfirmation(
      "Dados enviados. O negócio recebeu todo o contexto da jornada.",
    );
  }

  async function share() {
    const data = {
      title: project.name,
      text: project.description,
      url: location.href,
    };
    if (navigator.share) await navigator.share(data);
    else await navigator.clipboard.writeText(location.href);
  }

  if (!step) return null;
  const previewWhatsAppOption = preview
    ? step.options?.find((option) => option.actionType === "open_whatsapp")
    : undefined;
  const previewDestination = previewWhatsAppOption
    ? project.commercialConfig?.routingDestinations?.find(
        (destination) => destination.id === previewWhatsAppOption.actionPayload?.destinationId && destination.type === "whatsapp",
      )
    : undefined;
  const previewPhone = String(previewDestination?.value || previewWhatsAppOption?.actionPayload?.phone || project.phone || "");
  const previewHandoff = hasRecommendationJourney
    ? buildRecommendationHandoff({
        answers: runtime.answers,
        fields: project.steps.flatMap((candidate) => candidate.formFields || []),
        serviceName: selectedRecommendation?.name,
        confidence: runtime.recommendationConfidence,
      })
    : { answers: stringAnswers(runtime.answers), closing: undefined };
  const previewMessage = previewWhatsAppOption
    ? String(previewWhatsAppOption.actionPayload?.message || "") || buildWhatsAppMessage({
        businessName: project.name,
        interest: step.title,
        answers: previewHandoff.answers,
        closing: previewHandoff.closing,
      })
    : "";
  const style = {
    "--primary": palette.primary,
    "--primary-fg": palette.primaryForeground,
    "--secondary": palette.secondary,
    "--accent": palette.accent,
    "--background": palette.background,
    "--surface": palette.surface,
    "--foreground": palette.foreground,
    "--muted": palette.muted,
    "--muted-fg": palette.mutedForeground,
    "--border": project.designSystem.cards.style === "flat" ? "transparent" : (project.designSystem.cards.borderColor || palette.border),
    "--destructive": palette.destructive,
    "--card-radius": `${project.designSystem.shape.cardRadius}px`,
    "--button-radius": `${project.designSystem.shape.buttonRadius}px`,
    "--input-radius": `${project.designSystem.shape.inputRadius}px`,
    "--card-shadow": project.designSystem.cards.style === "elevated" ? project.designSystem.elevation.cardShadow : project.designSystem.cards.style === "glass" ? "0 16px 45px rgba(15,23,42,.12)" : "none",
  } as React.CSSProperties;
  const blocks = step.blocks || [];
  const primaryButtonClass = project.designSystem.buttons.style === "outline"
    ? "border-[var(--primary)] bg-transparent text-[var(--primary)]"
    : project.designSystem.buttons.style === "soft"
      ? "border-transparent bg-[var(--muted)] text-[var(--primary)]"
      : project.designSystem.buttons.style === "glass"
        ? "border-white/40 bg-white/20 text-[var(--foreground)] backdrop-blur"
        : project.designSystem.buttons.style === "gradient"
          ? "border-transparent bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-[var(--primary-fg)]"
          : "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]";

  return (
    <div
      style={{
        ...style,
        fontFamily: `"${project.designSystem.typography.bodyFont}", Inter, ui-sans-serif, system-ui, sans-serif`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      className="relative flex min-h-full min-w-0 flex-col overflow-x-clip bg-[var(--background)] text-[var(--foreground)]"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[var(--primary)] opacity-[var(--glow-opacity,.1)] blur-3xl" />
      <header className="relative flex min-w-0 items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={back}
          disabled={!history.length}
          aria-label="Voltar"
          className="grid size-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] disabled:invisible"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex min-w-0 items-center justify-center gap-2">
          {project.brand.logoDataUrl ? (
            <img
              src={project.brand.logoDataUrl}
              alt={project.name}
              className="max-h-9 max-w-28 object-contain"
            />
          ) : (
            <span className="max-w-[50vw] truncate text-center text-xs font-extrabold leading-4" title={project.name}>{project.name}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void share()}
          aria-label="Compartilhar"
          className="grid size-10 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)]"
        >
          <Share2 size={17} />
        </button>
      </header>
      <div className="relative mx-5 mt-4 h-1 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-[var(--primary)] transition-[width]"
          style={{
            width: `${Math.max(6, ((stepIndex + 1) / activeSteps.length) * 100)}%`,
          }}
        />
      </div>
      <main className="relative flex min-w-0 flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.section
            key={step.id}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{
              duration: reduceMotion
                ? 0
                : project.designSystem.motion.duration / 1000,
            }}
            className="min-w-0 w-full max-w-[620px]"
          >
            <p className="max-w-full break-normal text-xs font-extrabold uppercase tracking-[.16em] text-[var(--primary)] [hyphens:none] [overflow-wrap:break-word]">
              {project.name}
            </p>
            <h1
              className={cn(
                "mt-4 max-w-full break-normal font-extrabold leading-[1.02] tracking-[-.04em] [hyphens:none] [overflow-wrap:break-word]",
                preview ? "text-3xl" : "text-[clamp(2rem,8vw,3.6rem)]",
              )}
              style={{
                fontFamily: `"${project.designSystem.typography.headingFont}", Inter, ui-sans-serif, system-ui, sans-serif`,
                fontWeight: project.designSystem.typography.headingWeight,
              }}
            >
              {step.title}
            </h1>
            {step.description ? (
              <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted-fg)]">
                {step.description}
              </p>
            ) : null}
            {displayedRecommendation ? (
              <div className="mt-7 rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--primary)]">
                  {displayedRecommendation.label || "Recomendado"}
                </span>
                <h2 className="mt-2 max-w-full break-normal text-2xl font-extrabold [hyphens:none] [overflow-wrap:break-word]">
                  {displayedRecommendation.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-fg)]">
                  {displayedRecommendation.description}
                </p>
                <ul className="mt-4 grid gap-2">
                  {displayedRecommendation.benefits.map((benefit) => (
                    <li
                      key={benefit}
                      className="flex items-center gap-2 text-xs font-semibold"
                    >
                      <span className="grid size-5 place-items-center rounded-full bg-[var(--muted)] text-[var(--primary)]">
                        <Check size={12} />
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {previewWhatsAppOption ? (
              <aside className="mt-7 rounded-[var(--card-radius)] border border-dashed border-[var(--primary)] bg-[var(--muted)] p-4" aria-label="Verificação do destino">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--primary)]">Verificação da prévia</p>
                <p className="mt-2 text-sm font-bold">CTA: {previewWhatsAppOption.label}</p>
                <p className="mt-1 text-xs text-[var(--muted-fg)]">Destino: WhatsApp terminado em {previewPhone.replace(/\D/g, "").slice(-4) || "não configurado"}</p>
                <p className="mt-3 text-xs font-bold">Mensagem que será preparada</p>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-5 text-[var(--muted-fg)]">{previewMessage}</pre>
                <p className="mt-3 text-xs text-[var(--muted-fg)]">Nenhuma mensagem é enviada no modo de prévia.</p>
              </aside>
            ) : null}
            {blocks.length ? (
              <div className="mt-7 flex flex-col gap-3">
                {blocks.map((block) => (
                  <BlockRendererView
                    key={block.id}
                    block={block}
                    project={project}
                    runtime={runtime}
                    setRuntime={setRuntime}
                    mediaFilesRef={mediaFiles}
                    emit={emit}
                  />
                ))}
              </div>
            ) : null}
            <form onSubmit={submitStep} className="mt-7 flex min-w-0 flex-col gap-4">
              {progressiveQualification && qualificationFields.length > 1 ? (
                <p className="text-xs font-semibold text-[var(--muted-fg)]" aria-live="polite">
                  Pergunta {renderedFormFields.length} de até {qualificationFields.length}
                </p>
              ) : null}
              {renderedFormFields.map((field) => (
                <label key={field.id} className="block min-w-0">
                  <span className="mb-2 block text-xs font-bold">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  <FieldControl
                    field={field}
                    value={runtime.answers[field.key]}
                    onChange={(value) => updateAnswer(field.key, value)}
                    onFocus={() => {
                      if (!formStarted.current) {
                        formStarted.current = true;
                        emit("form_started");
                      }
                    }}
                  />
                </label>
              ))}
              {step.options?.map((option, index) => {
                const submitsForm = Boolean(
                  step.formFields?.length && index === 0,
                );
                return (
                  <button
                    key={option.id}
                    type={submitsForm ? "submit" : "button"}
                    onClick={submitsForm ? undefined : () => void act(option)}
                    disabled={busy}
                    className={cn(
                      "group flex min-h-14 w-full items-center gap-3 rounded-[var(--button-radius)] border p-3.5 text-left text-sm font-bold transition active:scale-[.99] disabled:opacity-60",
                      index === 0
                        ? primaryButtonClass
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-xl",
                        index === 0
                          ? "bg-white/15"
                          : "bg-[var(--muted)] text-[var(--primary)]",
                      )}
                    >
                      {busy && index === 0 ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <DynamicIcon name={option.icon} />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block break-normal [hyphens:none] [overflow-wrap:break-word]">
                        {progressiveQualification && index === 0 && hasMoreQualificationQuestions && !canFinishQualificationEarly
                          ? "Continuar"
                          : option.label}
                      </span>
                      {option.description ? (
                        <small
                          className={cn(
                            "mt-0.5 block font-normal",
                            index === 0
                              ? "opacity-75"
                              : "text-[var(--muted-fg)]",
                          )}
                        >
                          {option.description}
                        </small>
                      ) : null}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              })}
            </form>
            {leadForm ? (
              <form
                onSubmit={submitLead}
                className="mt-5 flex flex-col gap-3 rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <strong>Seus dados para continuar</strong>
                <input
                  aria-label="Nome"
                  required
                  value={String(runtime.answers.name || "")}
                  onChange={(event) => updateAnswer("name", event.target.value)}
                  placeholder="Nome"
                  className="min-h-12 rounded-[var(--input-radius)] border border-[var(--border)] bg-transparent px-3 text-sm"
                />
                <input
                  aria-label="WhatsApp"
                  required
                  value={String(runtime.answers.phone || "")}
                  onChange={(event) =>
                    updateAnswer("phone", event.target.value)
                  }
                  placeholder="WhatsApp"
                  className="min-h-12 rounded-[var(--input-radius)] border border-[var(--border)] bg-transparent px-3 text-sm"
                />
                <button className="min-h-12 rounded-[var(--button-radius)] bg-[var(--primary)] text-sm font-bold text-[var(--primary-fg)]">
                  Enviar com contexto
                </button>
              </form>
            ) : null}
            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-[var(--input-radius)] border border-[var(--destructive)]/30 bg-[var(--surface)] p-3 text-sm text-[var(--destructive)]"
              >
                {error}
              </div>
            ) : null}
            {confirmation ? (
              <div
                role="status"
                className="mt-4 rounded-[var(--input-radius)] border border-[var(--primary)]/30 bg-[var(--muted)] p-4 text-sm font-semibold"
              >
                <Check className="mr-2 inline" size={17} />
                {confirmation}
              </div>
            ) : null}
            {submitted && !confirmation ? (
              <p
                role="status"
                className="mt-4 text-sm font-semibold text-[var(--primary)]"
              >
                Concluído.
              </p>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </main>
      <footer className="relative px-5 pb-4 text-center text-xs font-semibold text-[var(--muted-fg)]">
        Não encontrou o que procura?{" "}
        <button
          type="button"
          onClick={() => {
            const whatsapp = step.options?.find(
              (option) => option.actionType === "open_whatsapp",
            );
            if (whatsapp) void act(whatsapp);
          }}
          className="font-extrabold text-[var(--primary)]"
        >
          Fale com a gente
        </button>
        <span className="mx-2 opacity-30">·</span>
        <Link href="/" className="inline-flex items-center gap-1.5 font-extrabold text-[var(--primary)]">
          <Image src="/brand/sobe-symbol.png" alt="" width={20} height={20} className="size-5 object-contain" />
          Feito com Sobe
        </Link>
      </footer>
    </div>
  );
}

export function PublicExperience({
  slug,
  preview = false,
  initialProject,
}: {
  slug: string;
  preview?: boolean;
  initialProject?: Project | null;
}) {
  const [project, setProject] = useState<Project | null | undefined>(
    initialProject,
  );
  useEffect(() => {
    const local = localStore.getProject(slug);
    if (local) setProject(local);
    else if (initialProject !== undefined) setProject(initialProject);
    else setProject(null);
    if (!preview)
      void fetch(`/api/public/projects/${encodeURIComponent(slug)}/experience`)
        .then(async (response) => {
          if (!response.ok) return;
          const payload = (await response.json()) as {
            data?: { project?: Project };
          };
          if (payload.data?.project) setProject(payload.data.project);
        })
        .catch(() => undefined);
  }, [initialProject, preview, slug]);
  if (project === undefined)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center">
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-sm font-semibold text-[#74747e]"
        >
          <LoaderCircle className="animate-spin text-[#0054fc]" />
          Carregando experiência…
        </div>
      </div>
    );
  if (!project || (!preview && project.status !== "published"))
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0054fc]">
            <Compass />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold">
            {preview ? "Prévia indisponível" : "Experiência indisponível"}
          </h1>
          <p className="mt-2 text-sm text-[#74747e]">
            {preview
              ? "Volte ao editor, confirme que o projeto foi salvo e tente novamente."
              : "O endereço não existe ou ainda não foi publicado."}
          </p>
          <Link
            href={preview ? "/app/projects" : "/"}
            className="mt-6 inline-flex font-bold text-[#0054fc]"
          >
            {preview ? "Voltar aos projetos" : "Conhecer a Sobe"}
          </Link>
        </div>
      </div>
    );
  return (
    <div
      className="min-h-screen"
      style={{ background: project.designSystem.colors.background }}
    >
      <div
        className={
          preview
            ? "mx-auto h-full max-w-md"
            : "mx-auto min-h-screen w-full max-w-[760px] shadow-[0_0_80px_rgba(0,0,0,.12)]"
        }
      >
        <ExperienceCanvas project={project} preview={preview} />
      </div>
    </div>
  );
}
