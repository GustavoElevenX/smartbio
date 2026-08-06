"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { PublishReadinessModal } from "@/components/publishing/publish-readiness-modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { analyzeBrandFile } from "@/features/brand-intelligence/brand-analyzer";
import { buildPalette } from "@/features/brand-intelligence/colors";
import { RuleBasedBusinessAnalyzer } from "@/features/business-understanding/rule-based-business-analyzer";
import { CapabilityPlanner } from "@/features/capabilities/capability-planner";
import { capabilityRegistry } from "@/features/capabilities/capability-registry";
import { experienceComposer } from "@/features/composition/experience-composer";
import { personalityOptions } from "@/lib/constants";
import { projectRepository } from "@/lib/repositories/project-repository";
import { localStore } from "@/lib/local-store";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { slugify } from "@/lib/utils";
import type {
  BrandProfile,
  BusinessCapabilityProfile,
  CapabilityKey,
  CapacityKind,
  CommercialIntent,
  CompletionChannel,
  ConfirmationMode,
  ExperienceCompositionInput,
  OfferKind,
  Project,
} from "@/types";

const stages = [
  "Negócio",
  "Oferta",
  "Objetivo",
  "Confirmação",
  "Capacidade",
  "Conclusão",
  "Marca",
  "Revisão",
];
const offerOptions: Array<[OfferKind, string, string]> = [
  ["service", "Serviço", "Limpeza, manutenção ou atendimento sob demanda"],
  [
    "professional_service",
    "Serviço profissional",
    "Consultoria, clínica, agência ou especialista",
  ],
  ["physical_product", "Produto físico", "Loja, delivery, kits ou encomendas"],
  ["digital_product", "Produto digital", "Curso, material ou acesso online"],
  ["hospitality", "Hospedagem", "Chalé, pousada, hotel ou acomodação"],
  ["rental", "Locação", "Sala, quadra, equipamento ou espaço"],
  ["event", "Evento", "Inscrição, ingresso ou participação"],
  ["membership", "Assinatura", "Clube, comunidade ou recorrência"],
];
const intentOptions: Array<[CommercialIntent, string]> = [
  ["request_quote", "Pedir orçamento"],
  ["request_proposal", "Solicitar proposta"],
  ["schedule", "Agendar"],
  ["check_availability", "Consultar disponibilidade"],
  ["reserve", "Reservar"],
  ["order", "Fazer pedido"],
  ["buy", "Comprar"],
  ["register", "Inscrever-se"],
  ["contact", "Entrar em contato"],
];
const capacityOptions: Array<[CapacityKind, string]> = [
  ["none", "Sem limite operacional"],
  ["time_slot", "Horários"],
  ["professional", "Profissionais"],
  ["location", "Unidades"],
  ["room", "Quartos ou acomodações"],
  ["table", "Mesas"],
  ["asset", "Espaços ou equipamentos"],
  ["inventory", "Estoque"],
  ["daily_capacity", "Limite diário"],
];
const confirmationOptions: Array<[ConfirmationMode, string, string]> = [
  [
    "manual_approval",
    "Após sua aprovação",
    "O visitante envia a solicitação e aguarda a confirmação.",
  ],
  [
    "instant",
    "Na hora",
    "A confirmação acontece imediatamente quando houver capacidade.",
  ],
  [
    "external_system",
    "Em outro sistema",
    "A jornada termina em uma agenda, checkout ou sistema externo.",
  ],
];
const completionOptions: Array<[CompletionChannel, string]> = [
  ["native", "Confirmar dentro da experiência"],
  ["whatsapp", "Continuar no WhatsApp"],
  ["external_url", "Abrir um link externo"],
  ["email", "Enviar por e-mail"],
  ["phone", "Ligar"],
];
const defaultBrand: BrandProfile = {
  extractedColors: ["#6D5EF5", "#FF725E", "#19B88B"],
  activePalette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"]),
  paletteVariations: [
    {
      name: "Fiel",
      palette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"], "faithful"),
    },
    {
      name: "Equilibrada",
      palette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"], "balanced"),
    },
    {
      name: "Ousada",
      palette: buildPalette(["#6D5EF5", "#FF725E", "#19B88B"], "bold"),
    },
  ],
  brandPersonality: ["Minimalista"],
};

function ChoiceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring relative min-h-[88px] rounded-[18px] border p-4 text-left transition ${active ? "border-[#7164e7] bg-[#f0eeff] shadow-[0_0_0_3px_rgba(113,100,231,.09)]" : "border-[#e0dfe7] bg-white hover:border-[#bebbcf]"}`}
    >
      <strong className="block text-sm">{title}</strong>
      {description ? (
        <span className="mt-1.5 block text-xs leading-5 text-[#777781]">
          {description}
        </span>
      ) : null}
      {active ? (
        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-[#685be0] text-white">
          <Check size={12} />
        </span>
      ) : null}
    </button>
  );
}

function toggleValue<T extends string>(items: T[], item: T) {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item];
}

export function OnboardingWizard() {
  const router = useRouter();
  const [stage, setStage] = useState(1);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [aiAnalyzing, setAIAnalyzing] = useState(false);
  const [aiSuggestions, setAISuggestions] = useState<CapabilityKey[]>([]);
  const [selectedAISuggestions, setSelectedAISuggestions] = useState<CapabilityKey[]>([]);
  const [brand, setBrand] = useState<BrandProfile>(defaultBrand);
  const [offerKinds, setOfferKinds] = useState<OfferKind[]>([]);
  const [intents, setIntents] = useState<CommercialIntent[]>([]);
  const [confirmationMode, setConfirmationMode] =
    useState<ConfirmationMode>("manual_approval");
  const [capacityKinds, setCapacityKinds] = useState<CapacityKind[]>(["none"]);
  const [completionChannel, setCompletionChannel] =
    useState<CompletionChannel>("whatsapp");
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    websiteUrl: "",
    category: "",
    description: "",
    audience: "",
    phone: "",
    destination: "",
    personality: "Minimalista",
    visualDirection: "Equilibrada",
    hasMultipleLocations: false,
    requiresMediaUpload: false,
    requiresPayment: false,
    allowsCancellationRequest: true,
    allowsRescheduleRequest: true,
  });
  const update = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const compositionInput = useMemo<ExperienceCompositionInput>(
    () => ({
      businessName: form.businessName,
      businessDescription: form.description,
      primaryGoal: intents[0] || "contact",
      primaryDestination:
        completionOptions.find(([key]) => key === completionChannel)?.[1] ||
        "WhatsApp",
      slug: form.slug,
      websiteUrl: form.websiteUrl || undefined,
      category: form.category || undefined,
      audience: form.audience || undefined,
      phone: form.phone || undefined,
      offerKinds,
      primaryIntents: intents,
      confirmationMode,
      capacityKinds,
      hasMultipleLocations: form.hasMultipleLocations,
      requiresMediaUpload: form.requiresMediaUpload,
      requiresPayment: form.requiresPayment,
      allowsCancellationRequest: form.allowsCancellationRequest,
      allowsRescheduleRequest: form.allowsRescheduleRequest,
      completionChannel,
      brandPersonality: [form.personality],
      visualDirection: form.visualDirection,
      brand: { ...brand, brandPersonality: [form.personality] },
    }),
    [
      brand,
      capacityKinds,
      completionChannel,
      confirmationMode,
      form,
      intents,
      offerKinds,
    ],
  );
  const profile = useMemo(
    () => new RuleBasedBusinessAnalyzer().analyze(compositionInput),
    [compositionInput],
  );
  const suggestedCapabilities = useMemo(
    () => new CapabilityPlanner().plan(profile),
    [profile],
  );

  async function logoChanged(file?: File) {
    if (!file) return;
    setAnalyzing(true);
    setError("");
    try {
      setBrand({
        ...(await analyzeBrandFile(file)),
        brandPersonality: [form.personality],
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível analisar a logo.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function validStage() {
    if (stage === 1)
      return Boolean(
        form.businessName && form.slug && form.description.length >= 15,
      );
    if (stage === 2) return offerKinds.length > 0;
    if (stage === 3) return intents.length > 0;
    if (stage === 5) return capacityKinds.length > 0;
    if (stage === 6)
      return (
        completionChannel !== "whatsapp" ||
        form.phone.replace(/\D/g, "").length >= 10
      );
    return true;
  }

  function next() {
    if (!validStage()) {
      setError("Complete as informações principais para continuar.");
      return;
    }
    setError("");
    setStage((current) => Math.min(8, current + 1));
  }

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const composed = selectedAISuggestions.length ? await (async () => { const response = await fetch("/api/projects/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(compositionInput) }); const payload = await response.json() as { data?: Project; error?: { message?: string } }; if (!response.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível compor com IA."); return payload.data; })() : await experienceComposer.compose(compositionInput);
      const created = selectedAISuggestions.length ? { ...composed, capabilities: (composed.capabilities || []).map((capability) => selectedAISuggestions.includes(capability.key) ? { ...capability, enabled: true, source: "ai" as const } : capability) } : composed;
      const saved = await projectRepository.saveProject(created);
      setProject(saved);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível criar a experiência.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function analyzeWithAI() {
    if (!validStage() && stage === 1) { setError("Informe nome, slug e descrição antes de pedir sugestões."); return; }
    setAIAnalyzing(true); setError("");
    try {
      const startResponse = await fetch("/api/ai/setup/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: { businessName: form.businessName, description: form.description, websiteUrl: form.websiteUrl || undefined, phone: form.phone || undefined }, sources: [] }) });
      const started = await startResponse.json() as { data?: { id: string }; error?: { message?: string } };
      if (!startResponse.ok || !started.data) throw new Error(started.error?.message || "Não foi possível iniciar a análise.");
      const analyzeResponse = await fetch(`/api/ai/setup/${started.data.id}/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const analyzed = await analyzeResponse.json() as { data?: { extractedProfile?: BusinessCapabilityProfile }; error?: { message?: string } };
      if (!analyzeResponse.ok || !analyzed.data?.extractedProfile) throw new Error(analyzed.error?.message || "A análise não retornou sugestões.");
      const capabilities = new CapabilityPlanner().plan(analyzed.data.extractedProfile).filter((item) => item.enabled).map((item) => item.key);
      setAISuggestions(capabilities); setSelectedAISuggestions([]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível analisar com IA."); }
    finally { setAIAnalyzing(false); }
  }

  async function publish() {
    if (!project) return;
    setGenerating(true);
    try {
      const saved = await projectRepository.saveProject(project);
      setProject(saved);
      setPublishOpen(true);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1140px] animate-enter">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#6d5ef5]">
            Configuração guiada
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-[-.035em]">
            Crie sua experiência de conversão
          </h1>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-[#777781]">
            Etapa {stage} de 8 · {stages[stage - 1]}
          </span>
          <div className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-[#e6e4ed]">
            <div
              className="h-full rounded-full bg-[#6d5ef5] transition-all"
              style={{ width: `${(stage / 8) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-[#e3e2e9] bg-white shadow-[0_20px_60px_rgba(31,28,55,.07)]">
        <div className="grid min-h-[650px] lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="p-6 sm:p-10 lg:p-12">
            {stage === 1 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">01 · Negócio</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  Conte o que você resolve.
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#71717b]">
                  A análise combina o que você informa com sinais da descrição —
                  sem encaixar seu negócio em um modelo fixo.
                </p>
                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="business-name">Nome do negócio</Label>
                    <Input
                      id="business-name"
                      value={form.businessName}
                      onChange={(event) => {
                        update("businessName", event.target.value);
                        if (!form.slug)
                          update("slug", slugify(event.target.value));
                      }}
                      placeholder="Ex.: LimpaBem Estofados"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">Endereço público</Label>
                    <Input
                      id="slug"
                      value={form.slug}
                      onChange={(event) =>
                        update("slug", slugify(event.target.value))
                      }
                      placeholder="limpabem"
                    />
                  </div>
                  <div>
                    <Label htmlFor="website">
                      Site{" "}
                      <span className="font-normal text-[#91919a]">
                        (opcional)
                      </span>
                    </Label>
                    <Input
                      id="website"
                      type="url"
                      value={form.websiteUrl}
                      onChange={(event) =>
                        update("websiteUrl", event.target.value)
                      }
                      placeholder="https://seusite.com.br"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">
                      Categoria{" "}
                      <span className="font-normal text-[#91919a]">
                        (opcional)
                      </span>
                    </Label>
                    <Input
                      id="category"
                      value={form.category}
                      onChange={(event) =>
                        update("category", event.target.value)
                      }
                      placeholder="Ex.: Serviços residenciais"
                    />
                  </div>
                </div>
                <div className="mt-5">
                  <Label htmlFor="description">O que você oferece?</Label>
                  <Textarea
                    id="description"
                    className="min-h-32"
                    value={form.description}
                    onChange={(event) =>
                      update("description", event.target.value.slice(0, 600))
                    }
                    placeholder="Descreva a oferta, como o preço é definido e o que o cliente precisa fazer."
                  />
                  <small className="mt-1 block text-right text-[#8b8b94]">
                    {form.description.length}/600
                  </small>
                </div>
                <div className="mt-4">
                  <Label htmlFor="audience">Para quem?</Label>
                  <Input
                    id="audience"
                    value={form.audience}
                    onChange={(event) => update("audience", event.target.value)}
                    placeholder="Ex.: famílias e empresas da região"
                  />
                </div>
              </section>
            ) : null}

            {stage === 2 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">02 · Oferta</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  O que o cliente encontra?
                </h2>
                <p className="mt-3 text-sm text-[#71717b]">
                  Selecione tudo o que se aplica. Negócios híbridos podem
                  combinar capacidades.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {offerOptions.map(([key, label, description]) => (
                    <ChoiceCard
                      key={key}
                      active={offerKinds.includes(key)}
                      title={label}
                      description={description}
                      onClick={() =>
                        setOfferKinds((current) => toggleValue(current, key))
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {stage === 3 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">
                  03 · Objetivo
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  O que o visitante deve conseguir fazer?
                </h2>
                <p className="mt-3 text-sm text-[#71717b]">
                  A primeira opção será tratada como objetivo principal; as
                  demais criam caminhos complementares.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {intentOptions.map(([key, label]) => (
                    <ChoiceCard
                      key={key}
                      active={intents.includes(key)}
                      title={label}
                      onClick={() =>
                        setIntents((current) => toggleValue(current, key))
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {stage === 4 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">
                  04 · Confirmação
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  Quando a ação está realmente confirmada?
                </h2>
                <div className="mt-8 grid gap-3">
                  {confirmationOptions.map(([key, label, description]) => (
                    <ChoiceCard
                      key={key}
                      active={confirmationMode === key}
                      title={label}
                      description={description}
                      onClick={() => setConfirmationMode(key)}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {stage === 5 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">
                  05 · Capacidade
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  O que limita seu atendimento?
                </h2>
                <p className="mt-3 text-sm text-[#71717b]">
                  Isso define quando mostrar agenda, disponibilidade, estoque ou
                  roteamento.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {capacityOptions.map(([key, label]) => (
                    <ChoiceCard
                      key={key}
                      active={capacityKinds.includes(key)}
                      title={label}
                      onClick={() =>
                        setCapacityKinds((current) =>
                          key === "none"
                            ? ["none"]
                            : toggleValue(
                                current.filter((item) => item !== "none"),
                                key,
                              ),
                        )
                      }
                    />
                  ))}
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl bg-[#f6f5f9] p-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.hasMultipleLocations}
                      onChange={(event) =>
                        update("hasMultipleLocations", event.target.checked)
                      }
                    />{" "}
                    Tenho mais de uma unidade
                  </label>
                  <label className="flex items-center gap-3 rounded-xl bg-[#f6f5f9] p-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.requiresMediaUpload}
                      onChange={(event) =>
                        update("requiresMediaUpload", event.target.checked)
                      }
                    />{" "}
                    Fotos ajudam a avaliar
                  </label>
                  <label className="flex items-center gap-3 rounded-xl bg-[#f6f5f9] p-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.allowsCancellationRequest}
                      onChange={(event) =>
                        update(
                          "allowsCancellationRequest",
                          event.target.checked,
                        )
                      }
                    />{" "}
                    Aceito pedido de cancelamento
                  </label>
                  <label className="flex items-center gap-3 rounded-xl bg-[#f6f5f9] p-4 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={form.allowsRescheduleRequest}
                      onChange={(event) =>
                        update("allowsRescheduleRequest", event.target.checked)
                      }
                    />{" "}
                    Aceito pedido de remarcação
                  </label>
                </div>
              </section>
            ) : null}

            {stage === 6 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">
                  06 · Conclusão
                </p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  Onde a conversa continua?
                </h2>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {completionOptions.map(([key, label]) => (
                    <ChoiceCard
                      key={key}
                      active={completionChannel === key}
                      title={label}
                      onClick={() => setCompletionChannel(key)}
                    />
                  ))}
                </div>
                {completionChannel === "whatsapp" ? (
                  <div className="mt-5">
                    <Label htmlFor="phone">WhatsApp com DDI</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      placeholder="5511999999999"
                      inputMode="tel"
                    />
                  </div>
                ) : null}
                {completionChannel === "external_url" ? (
                  <div className="mt-5">
                    <Label htmlFor="destination">Link de destino</Label>
                    <Input
                      id="destination"
                      type="url"
                      value={form.destination}
                      onChange={(event) =>
                        update("destination", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                ) : null}
                <label className="mt-6 flex items-center gap-3 rounded-xl bg-[#f6f5f9] p-4 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.requiresPayment}
                    onChange={(event) =>
                      update("requiresPayment", event.target.checked)
                    }
                  />{" "}
                  Pode haver pagamento ou sinal externo
                </label>
              </section>
            ) : null}

            {stage === 7 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">07 · Marca</p>
                <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                  Dê o tom da experiência.
                </h2>
                <div className="mt-7 grid gap-6 sm:grid-cols-[190px_1fr]">
                  <label className="focus-within:ring-4 flex min-h-[180px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] border-2 border-dashed border-[#d8d5e6] bg-[#faf9fd] p-4 text-center">
                    {brand.logoDataUrl ? (
                      <img
                        src={brand.logoDataUrl}
                        alt="Prévia da logo"
                        className="max-h-28 max-w-full object-contain"
                      />
                    ) : (
                      <>
                        <Upload size={22} className="text-[#6355dc]" />
                        <strong className="mt-3 text-xs">Enviar logo</strong>
                        <span className="mt-1 text-[11px] text-[#85858e]">
                          PNG, JPG, WebP ou SVG
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="sr-only"
                      onChange={(event) =>
                        void logoChanged(event.target.files?.[0])
                      }
                    />
                  </label>
                  <div>
                    <Label>Personalidade</Label>
                    <div className="flex flex-wrap gap-2">
                      {personalityOptions.map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => update("personality", item)}
                          className={`focus-ring rounded-full border px-3 py-2 text-xs font-semibold ${form.personality === item ? "border-[#7164e7] bg-[#efedff] text-[#584bd0]" : "border-[#dfdee6]"}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6">
                      <Label>Direção de cores</Label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {brand.paletteVariations.map((variation) => (
                        <button
                          type="button"
                          key={variation.name}
                          aria-label={`Usar direção ${variation.name}`}
                          onClick={() => {
                            update("visualDirection", variation.name);
                            setBrand((current) => ({
                              ...current,
                              activePalette: variation.palette,
                            }));
                          }}
                          className={`rounded-xl border p-2 ${form.visualDirection === variation.name ? "border-[#6d5ef5] ring-2 ring-[#6d5ef5]/10" : "border-[#dfdee6]"}`}
                        >
                          <span className="flex h-12 overflow-hidden rounded-lg">
                            {[
                              variation.palette.primary,
                              variation.palette.background,
                              variation.palette.accent,
                            ].map((color) => (
                              <i
                                key={color}
                                className="flex-1"
                                style={{ background: color }}
                              />
                            ))}
                          </span>
                          <small className="mt-2 block font-bold">
                            {variation.name}
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {analyzing ? (
                  <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#5d50d3]">
                    <LoaderCircle size={17} className="animate-spin" />{" "}
                    Analisando identidade…
                  </p>
                ) : null}
              </section>
            ) : null}

            {stage === 8 ? (
              <section>
                <p className="text-sm font-bold text-[#675ada]">08 · Revisão</p>
                {project ? (
                  <>
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e8f7ef] px-3 py-2 text-xs font-bold text-[#147a57]">
                      <CheckCircle2 size={15} /> Experiência criada
                    </span>
                    <h2 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">
                      A jornada comercial está pronta.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#71717b]">
                      Foram compostas {project.steps.length} etapas com{" "}
                      {project.capabilities?.filter((item) => item.enabled)
                        .length || 0}{" "}
                      capacidades ativas. Você pode publicar ou ajustar cada
                      bloco no editor.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                      <Button
                        size="lg"
                        onClick={() => void publish()}
                        disabled={generating}
                      >
                        Publicar e editar <ArrowRight data-icon size={17} />
                      </Button>
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() =>
                          router.push(`/app/projects/${project.id}/editor`)
                        }
                      >
                        Personalizar
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-3 text-3xl font-extrabold tracking-[-.04em]">
                      Confira como a SmartBio entendeu seu negócio.
                    </h2>
                    <div className="mt-6 rounded-[20px] border border-[#dfdcf2] bg-[#f9f8ff] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3"><div><strong className="text-sm">Análise opcional com IA</strong><p className="mt-1 text-xs leading-5 text-[#74747e]">Receba sugestões sem substituir nenhum dado preenchido.</p></div><Button type="button" size="sm" variant="secondary" disabled={aiAnalyzing} onClick={() => void analyzeWithAI()}>{aiAnalyzing ? <LoaderCircle size={15} className="animate-spin" /> : <WandSparkles size={15} />}{aiAnalyzing ? "Analisando" : "Analisar e sugerir com IA"}</Button></div>
                      {aiSuggestions.length ? <div className="mt-4"><p className="mb-2 text-xs font-bold">Escolha o que deseja aplicar:</p><div className="flex flex-wrap gap-2">{aiSuggestions.map((key) => <button type="button" key={key} onClick={() => setSelectedAISuggestions((current) => toggleValue(current, key))} className={`focus-ring rounded-full border px-3 py-2 text-xs font-bold ${selectedAISuggestions.includes(key) ? "border-[#6658d9] bg-[#ebe8ff] text-[#5547c4]" : "border-[#dedce7] bg-white text-[#666670]"}`}>{selectedAISuggestions.includes(key) ? "✓ " : ""}{capabilityRegistry[key].label}</button>)}</div><p className="mt-3 text-xs text-[#777781]">Somente as sugestões marcadas serão acrescentadas ao rascunho.</p></div> : null}
                    </div>
                    <div className="mt-7 rounded-[20px] bg-[#f6f5f9] p-5">
                      <strong className="text-sm">Caminhos sugeridos</strong>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestedCapabilities.map((capability) => (
                          <span
                            key={capability.key}
                            className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#5c50cf]"
                          >
                            {capabilityRegistry[capability.key].label}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-xs leading-5 text-[#74747e]">
                        {profile.analysisMetadata?.reasons.join(" ")}
                      </p>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-[#e5e4eb] p-4">
                        <dt className="text-xs text-[#85858f]">Confirmação</dt>
                        <dd className="mt-1 font-bold">
                          {
                            confirmationOptions.find(
                              ([key]) => key === confirmationMode,
                            )?.[1]
                          }
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#e5e4eb] p-4">
                        <dt className="text-xs text-[#85858f]">Conclusão</dt>
                        <dd className="mt-1 font-bold">
                          {
                            completionOptions.find(
                              ([key]) => key === completionChannel,
                            )?.[1]
                          }
                        </dd>
                      </div>
                    </dl>
                    <Button
                      className="mt-7"
                      size="lg"
                      onClick={() => void generate()}
                      disabled={generating}
                    >
                      {generating ? (
                        <LoaderCircle
                          data-icon
                          size={17}
                          className="animate-spin"
                        />
                      ) : (
                        <WandSparkles data-icon size={17} />
                      )}{" "}
                      {generating ? "Compondo jornada…" : "Criar experiência"}
                    </Button>
                  </>
                )}
              </section>
            ) : null}

            {error ? (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-[#ffd1d1] bg-[#fff1f1] p-3 text-sm text-[#a83333]"
              >
                {error}
              </div>
            ) : null}
            {!project ? (
              <div className="mt-10 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStage((value) => Math.max(1, value - 1))}
                  disabled={stage === 1 || generating}
                >
                  <ArrowLeft data-icon size={17} /> Voltar
                </Button>
                {stage < 8 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={next}
                    disabled={analyzing}
                  >
                    Continuar <ArrowRight data-icon size={17} />
                  </Button>
                ) : null}
              </div>
            ) : null}
          </main>

          <aside className="relative overflow-hidden border-l border-[#e7e6ed] bg-[#f5f3fb] p-7">
            <div className="absolute -right-16 -top-16 size-48 rounded-full bg-[#dcd7ff] blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#6558da] shadow-sm">
                <Sparkles size={14} /> Conversão em construção
              </span>
              {project ? (
                <div className="mx-auto mt-7 h-[520px] w-[270px] overflow-hidden rounded-[34px] border-[6px] border-[#222126] bg-white">
                  <ExperienceCanvas project={project} preview />
                </div>
              ) : (
                <div className="mx-auto mt-8 w-[240px] rounded-[30px] border-[5px] border-[#222126] bg-white p-2 shadow-[0_25px_60px_rgba(40,34,78,.15)]">
                  <div
                    className="min-h-[430px] rounded-[22px] p-5"
                    style={{
                      background: brand.activePalette.background,
                      color: brand.activePalette.foreground,
                    }}
                  >
                    <span
                      className="grid size-10 place-items-center rounded-xl text-xs font-black"
                      style={{
                        background: brand.activePalette.primary,
                        color: brand.activePalette.primaryForeground,
                      }}
                    >
                      {(form.businessName || "SB").slice(0, 2).toUpperCase()}
                    </span>
                    <p
                      className="mt-12 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: brand.activePalette.primary }}
                    >
                      Seu próximo passo
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold leading-tight">
                      {form.businessName
                        ? `Como podemos ajudar você hoje?`
                        : "Sua experiência começa aqui."}
                    </h3>
                    <p className="mt-3 text-xs leading-5 opacity-60">
                      {form.description
                        ? `${form.description.slice(0, 92)}${form.description.length > 92 ? "…" : ""}`
                        : "As respostas do onboarding definem a jornada, os blocos e a próxima ação."}
                    </p>
                    <div className="mt-6 space-y-2">
                      {suggestedCapabilities.slice(0, 3).map((item) => (
                        <div
                          key={item.key}
                          className="rounded-[13px] border p-3 text-xs font-bold"
                          style={{
                            background: brand.activePalette.surface,
                            borderColor: brand.activePalette.border,
                          }}
                        >
                          {capabilityRegistry[item.key].label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      {project ? (
        <PublishReadinessModal
          open={publishOpen}
          onOpenChange={setPublishOpen}
          project={project}
          onPublished={(published) => {
            if (canUseLocalStore()) localStore.saveProject(published);
            setProject(published);
            router.push(`/app/projects/${published.id}/editor`);
          }}
        />
      ) : null}
    </div>
  );
}
