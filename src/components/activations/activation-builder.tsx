"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import type { Project } from "@/types";
import { localStore } from "@/lib/local-store";
import type {
  ActivationBuilderState,
  BuilderOption,
} from "./activation-builder-types";
import { ActivationBuilderGoal } from "./activation-builder-goal";
import { ActivationBuilderOffer } from "./activation-builder-offer";
import { ActivationBuilderEligibility } from "./activation-builder-eligibility";
import { ActivationBuilderScope } from "./activation-builder-scope";
import { ActivationBuilderSchedule } from "./activation-builder-schedule";
import { ActivationBuilderPlacements } from "./activation-builder-placements";
import { ActivationBuilderDestination } from "./activation-builder-destination";
import { ActivationBuilderConversion } from "./activation-builder-conversion";
import { ActivationBuilderPreview } from "./activation-builder-preview";
const steps = [
  "Objetivo",
  "Oferta",
  "Elegibilidade",
  "Escopo",
  "Período",
  "Onde aparecer",
  "Destino",
  "Resultado",
  "Preview",
  "Ativar",
];
const initial: ActivationBuilderState = {
  name: "",
  activationType: "promotion",
  conversionGoalId: "",
  offerType: "percentage_discount",
  percentage: "20",
  amount: "",
  minSubtotal: "",
  eligibility: "first_order_via_virou",
  startsAt: "",
  endsAt: "",
  placements: ["announcement_bar", "hero_override"],
  locationIds: [],
  completionChannel: "whatsapp",
  destinationMode: "routing",
  defaultDestinationId: "",
  conversionPolicy: "redemption_marks_conversion",
  title: "",
  message: "",
};
type ActivationComposeResponse = {
  data?: {
    draft?: {
      activation?: {
        name?: string;
        activationType?: ActivationBuilderState["activationType"];
        conversionGoalId?: string;
        eligibility?: { customerRule?: ActivationBuilderState["eligibility"] };
        startsAt?: string;
        endsAt?: string;
      };
      offer?: {
        offerType?: ActivationBuilderState["offerType"];
        percentage?: number;
        amount?: number;
        minSubtotal?: number;
      };
      placements?: Array<{
        placementType: ActivationBuilderState["placements"][number];
      }>;
    };
  };
  error?: { message?: string };
};
export function ActivationBuilder({
  projectId,
  project: serverProject,
}: {
  projectId: string;
  project?: Project | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [step, setStep] = useState(0);
  const [project, setProject] = useState(serverProject || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [composing, setComposing] = useState(false);
  useEffect(() => {
    if (!project) setProject(localStore.getProject(projectId) || null);
  }, [project, projectId]);
  const goals: BuilderOption[] = (project?.conversionGoals || []).map(
    ({ id, name }) => ({ id, name }),
  );
  const locations: BuilderOption[] = (
    project?.commercialConfig?.locations || []
  ).map(({ id, name }) => ({ id, name }));
  const destinations: BuilderOption[] = (
    project?.commercialConfig?.routingDestinations || []
  ).map(({ id, label }) => ({ id, name: label }));
  const update = (patch: Partial<ActivationBuilderState>) =>
    setState((current) => ({ ...current, ...patch }));
  const offer = useMemo(
    () => ({
      offerType: state.offerType,
      label:
        state.offerType === "percentage_discount"
          ? `${state.percentage || 0}% OFF`
          : state.offerType === "fixed_discount"
            ? `R$ ${state.amount || 0} OFF`
            : state.offerType === "free_shipping"
              ? "Frete grátis"
              : state.offerType === "no_discount"
                ? "Sem desconto"
                : "Benefício",
      percentage:
        state.offerType === "percentage_discount"
          ? Number(state.percentage)
          : undefined,
      amount:
        state.offerType === "fixed_discount" ? Number(state.amount) : undefined,
      currency: "BRL",
      minSubtotal: state.minSubtotal ? Number(state.minSubtotal) : undefined,
      scope: { locationIds: state.locationIds },
      benefitConfig: {},
      isActive: true,
    }),
    [state],
  );
  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = {
        name: state.name || state.title || "Nova ativação",
        activationType: state.activationType,
        status: "draft",
        conversionGoalId: state.conversionGoalId || undefined,
        title: state.title || state.name,
        message: state.message,
        startsAt: state.startsAt
          ? new Date(state.startsAt).toISOString()
          : undefined,
        endsAt: state.endsAt ? new Date(state.endsAt).toISOString() : undefined,
        timezone: "America/Sao_Paulo",
        requiresIdentity: state.eligibility !== "any",
        identityMode: state.eligibility === "any" ? "none" : "phone",
        completionChannel: state.completionChannel,
        destinationMode: state.destinationMode,
        defaultDestinationId: state.defaultDestinationId || undefined,
        eligibility: {
          customerRule: state.eligibility,
          locationIds: state.locationIds,
          minSubtotal: state.minSubtotal
            ? Number(state.minSubtotal)
            : undefined,
        },
        limits: { maxClaimsPerCustomer: 1, maxRedemptionsPerCustomer: 1 },
        settings: {
          conversionPolicy: state.conversionPolicy,
          claimTtlMinutes: 1440,
          claimAfterActivationEnd: "honor_until_claim_expiry",
        },
        offers: [offer],
        placements: state.placements.map((placementType, index) => ({
          placementType,
          content: {
            title: state.title || state.name,
            message: state.message,
            ctaLabel:
              state.eligibility === "any" ? "Continuar" : "Quero meu benefício",
          },
          style: {},
          priority: 100 - index,
          isActive: true,
        })),
        locationIds: state.locationIds,
        entryPointIds: [],
      };
      const response = await fetch(`/api/projects/${projectId}/activations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        data?: { activation?: { id: string } };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.activation)
        throw new Error(payload.error?.message || "Não foi possível salvar.");
      router.push(
        `/app/projects/${projectId}/activations/${payload.data.activation.id}`,
      );
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function compose() {
    if (aiInstruction.trim().length < 3) return;
    setComposing(true);
    setError("");
    try {
      const response = await fetch(
        `/api/ai/projects/${projectId}/activations/compose`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ instruction: aiInstruction }),
        },
      );
      const payload = (await response.json()) as ActivationComposeResponse;
      const draft = payload.data?.draft;
      if (!response.ok || !draft)
        throw new Error(
          payload.error?.message || "Não foi possível criar o rascunho.",
        );
      update({
        name: draft.activation?.name || state.name,
        activationType:
          draft.activation?.activationType || state.activationType,
        conversionGoalId:
          draft.activation?.conversionGoalId || state.conversionGoalId,
        eligibility:
          draft.activation?.eligibility?.customerRule || state.eligibility,
        startsAt: draft.activation?.startsAt
          ? draft.activation.startsAt.slice(0, 16)
          : state.startsAt,
        endsAt: draft.activation?.endsAt
          ? draft.activation.endsAt.slice(0, 16)
          : state.endsAt,
        offerType: draft.offer?.offerType || state.offerType,
        percentage: draft.offer?.percentage?.toString() || state.percentage,
        amount: draft.offer?.amount?.toString() || state.amount,
        minSubtotal: draft.offer?.minSubtotal?.toString() || state.minSubtotal,
        placements:
          draft.placements?.map((p) => p.placementType) || state.placements,
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível compor.",
      );
    } finally {
      setComposing(false);
    }
  }
  const content =
    step === 0 ? (
      <ActivationBuilderGoal state={state} goals={goals} onChange={update} />
    ) : step === 1 ? (
      <ActivationBuilderOffer state={state} onChange={update} />
    ) : step === 2 ? (
      <ActivationBuilderEligibility
        state={state}
        onChange={update}
        onImport={() =>
          router.push(
            `/app/projects/${projectId}/sources?purpose=customer_history`,
          )
        }
      />
    ) : step === 3 ? (
      <ActivationBuilderScope
        state={state}
        locations={locations}
        onChange={update}
      />
    ) : step === 4 ? (
      <ActivationBuilderSchedule state={state} onChange={update} />
    ) : step === 5 ? (
      <ActivationBuilderPlacements state={state} onChange={update} />
    ) : step === 6 ? (
      <ActivationBuilderDestination
        state={state}
        destinations={destinations}
        onChange={update}
      />
    ) : step === 7 ? (
      <ActivationBuilderConversion state={state} onChange={update} />
    ) : step === 8 ? (
      <ActivationBuilderPreview state={state} />
    ) : (
      <div>
        <h3 className="text-xl font-extrabold">Pronta para virar ação?</h3>
        <p className="mt-2 text-[#6f6f79]">
          Salve o rascunho. Na página de detalhe, a Sobe valida todos os
          bloqueios antes de ativar.
        </p>
        <div className="mt-5 rounded-xl bg-[#eaf3ff] p-4 text-sm text-[#0054fc]">
          <strong>Copy segura:</strong>{" "}
          {state.eligibility === "first_purchase_business_verified"
            ? "A publicação será bloqueada até existir cobertura histórica."
            : "A elegibilidade será confirmada somente ao solicitar o benefício."}
        </div>
      </div>
    );
  return (
    <div className="-m-4 min-h-[calc(100vh-73px)] bg-white sm:-m-6 lg:-m-8">
      <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e5e4ec] px-5">
        <div>
          <p className="text-xs font-bold text-[#0054fc]">Ativações</p>
          <h1 className="text-xl font-extrabold">Nova ativação</h1>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#0054fc] px-4 text-sm font-bold text-[#0054fc] disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={17} /> : null}Salvar
          rascunho
        </button>
      </header>
      <div className="grid min-h-[calc(100vh-145px)] lg:grid-cols-[230px_minmax(0,1fr)_350px]">
        <aside className="border-r border-[#e8e7ed] bg-[#f7fbff] p-4">
          <nav className="space-y-1" aria-label="Passos da ativação">
            {steps.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(index)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${step === index ? "bg-[#f7fbff] text-[#0054fc]" : "text-[#62626c] hover:bg-[#f0eff4]"}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs ${index < step ? "border-emerald-600 bg-emerald-600 text-white" : "border-[#d3d1da]"}`}
                >
                  {index < step ? <Check size={14} /> : index + 1}
                </span>
                {label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="p-5 sm:p-8">
          <div className="mx-auto max-w-3xl">
            <p className="text-sm font-bold text-[#0054fc]">
              Passo {step + 1} de 10
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
              {steps[step]}
            </h2>
            {step === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#dedbe9] bg-[#f7fbff] p-4">
                <label className="text-sm font-bold">Descrever com IA</label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={aiInstruction}
                    onChange={(e) => setAiInstruction(e.target.value)}
                    placeholder="Quero dar 20% em pedidos acima de R$ 50 até sexta."
                    className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#d9d6e7] bg-white px-4"
                  />
                  <button
                    type="button"
                    onClick={compose}
                    disabled={composing}
                    className="focus-ring inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#191820] px-4 text-sm font-bold text-white"
                  >
                    <Sparkles size={17} />
                    {composing ? "Criando…" : "Criar com IA"}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="mt-7">{content}</div>
            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700"
              >
                {error}
              </p>
            ) : null}
            <footer className="mt-9 flex items-center justify-between border-t border-[#ecebf0] pt-5">
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9d8e1] px-4 font-bold disabled:opacity-40"
              >
                <ArrowLeft size={17} />
                Voltar
              </button>
              {step < 9 ? (
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.min(9, value + 1))}
                  className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0054fc] px-5 font-bold text-white"
                >
                  Próximo
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0054fc] px-5 font-bold text-white"
                >
                  Salvar rascunho
                  <ArrowRight size={17} />
                </button>
              )}
            </footer>
          </div>
        </main>
        <aside className="hidden border-l border-[#e8e7ed] bg-[#f7fbff] p-5 lg:block">
          <h2 className="font-extrabold">Preview ao vivo</h2>
          <p className="mt-1 text-sm text-[#777780]">
            A Presence original permanece intacta.
          </p>
          <div className="mt-5">
            <ActivationBuilderPreview state={state} />
          </div>
          <div className="mt-6">
            <h3 className="font-extrabold">Prontidão</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {[
                [
                  "Objetivo definido",
                  Boolean(state.name && state.conversionGoalId),
                ],
                [
                  "Oferta configurada",
                  state.offerType === "no_discount" ||
                    Boolean(
                      state.percentage ||
                        state.amount ||
                        state.offerType === "free_shipping",
                    ),
                ],
                [
                  "Elegibilidade segura",
                  state.eligibility !== "first_purchase_business_verified",
                ],
                [
                  "Período válido",
                  !state.startsAt ||
                    !state.endsAt ||
                    state.endsAt > state.startsAt,
                ],
              ].map(([label, done]) => (
                <li key={String(label)} className="flex items-center gap-2">
                  <span
                    className={`grid size-5 place-items-center rounded-full text-xs ${done ? "bg-emerald-600 text-white" : "bg-[#e7e6ed] text-[#777780]"}`}
                  >
                    {done ? <Check size={12} /> : "·"}
                  </span>
                  {label as string}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
