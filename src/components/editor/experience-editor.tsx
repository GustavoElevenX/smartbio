"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Layers3,
  LoaderCircle,
  Palette,
  Plus,
  Redo2,
  Save,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { BlockEditor } from "@/components/editor/block-editor";
import { FormBuilder } from "@/components/editor/form-builder";
import { CapabilityPanel } from "@/components/editor/capability-panel";
import { AIFieldActions } from "@/components/editor/ai-field-actions";
import { AIScopeActions } from "@/components/editor/ai-scope-actions";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { PublishReadinessModal } from "@/components/publishing/publish-readiness-modal";
import {
  buildPalette,
  ensureAccessiblePalette,
} from "@/features/brand-intelligence/colors";
import { localStore } from "@/lib/local-store";
import { projectRepository } from "@/lib/repositories/project-repository";
import { canUseLocalStore } from "@/lib/runtime-mode";
import { uid } from "@/lib/utils";
import type { JourneyStep, Project, StepType } from "@/types";

const stepNames: Record<StepType, string> = {
  welcome: "Boas-vindas",
  choice: "Escolha",
  form: "Formulário",
  content: "Conteúdo",
  recommendation: "Recomendação",
  action: "Ação",
  thank_you: "Obrigado",
  quote: "Orçamento",
  catalog: "Catálogo",
  cart: "Carrinho",
  availability: "Disponibilidade",
  schedule: "Agenda",
  reservation: "Reserva",
  routing: "Roteamento",
  confirmation: "Confirmação",
};

function newStep(type: StepType, order: number): JourneyStep {
  const id = uid("step");
  return {
    id,
    type,
    title:
      type === "choice"
        ? "O que você quer escolher?"
        : type === "form"
          ? "Conte um pouco sobre você."
          : type === "recommendation"
            ? "Esta é nossa recomendação."
            : type === "action"
              ? "Como você quer continuar?"
              : type === "thank_you"
                ? "Tudo certo!"
                : "Nova etapa",
    description: "Edite este texto no painel ao lado.",
    settings: {
      generatedFields: {
        title: { generatedByAI: false, generatedPlaceholder: true, verificationStatus: "needs_confirmation" },
        description: { generatedByAI: false, generatedPlaceholder: true, verificationStatus: "needs_confirmation" },
        ...(type === "choice" || type === "action"
          ? { options: { generatedByAI: false, generatedPlaceholder: true, verificationStatus: "needs_confirmation" } }
          : {}),
        ...(type === "recommendation"
          ? { recommendation: { generatedByAI: false, generatedPlaceholder: true, verificationStatus: "needs_confirmation" } }
          : {}),
      },
    },
    order,
    isActive: true,
    options:
      type === "choice" || type === "action"
        ? [
            {
              id: uid("option"),
              label: "Primeira opção",
              value: "primeira-opcao",
              actionType: "finish",
            },
          ]
        : undefined,
    formFields:
      type === "form"
        ? [
            {
              id: uid("field"),
              label: "Nome",
              key: "name",
              type: "text",
              required: true,
            },
          ]
        : undefined,
    recommendation:
      type === "recommendation"
        ? {
            title: "Melhor próximo passo",
            description: "Uma solução alinhada ao seu momento.",
            benefits: ["Benefício principal", "Próximo passo claro"],
          }
        : undefined,
  };
}

export function ExperienceEditor({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"quick" | "advanced">("quick");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [addOpen, setAddOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewAs, setPreviewAs] = useState("bio");
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);
  const projectRef = useRef<Project | null>(null);
  useEffect(() => {
    let active = true;
    void projectRepository
      .getProject(projectId)
      .then((found) => {
        if (!active) return;
        const value = found || null;
        setProject(value);
        projectRef.current = value;
        setSelectedId(value?.steps[0]?.id || "");
      })
      .catch(() => {
        if (active) setProject(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (!project) return;
    projectRef.current = project;
    setSaveState("saving");
    const timer = setTimeout(() => {
      void projectRepository
        .saveProject(project)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 650);
    return () => clearTimeout(timer);
  }, [project]);
  useEffect(() => {
    const saveBeforeLeaving = () => {
      if (projectRef.current) localStore.saveProject(projectRef.current);
    };
    window.addEventListener("beforeunload", saveBeforeLeaving);
    return () => window.removeEventListener("beforeunload", saveBeforeLeaving);
  }, []);
  if (project === undefined)
    return (
      <div className="grid min-h-[600px] place-items-center">
        <LoaderCircle className="animate-spin text-[#6d5ef5]" />
      </div>
    );
  if (!project)
    return (
      <div className="grid min-h-[560px] place-items-center rounded-[24px] border border-[#e4e3ea] bg-white text-center">
        <div>
          <Layers3 className="mx-auto text-[#7468df]" />
          <h1 className="mt-4 text-xl font-extrabold">
            Projeto não encontrado
          </h1>
          <Link
            href="/app/projects"
            className="mt-4 inline-flex text-sm font-bold text-[#6255d8]"
          >
            Voltar aos projetos
          </Link>
        </div>
      </div>
    );
  const activeProject: Project = project;
  const selected =
    activeProject.steps.find((step) => step.id === selectedId) ||
    activeProject.steps[0];
  function commit(updater: (current: Project) => Project) {
    setUndoStack((items) => [
      ...items.slice(-19),
      structuredClone(activeProject),
    ]);
    setRedoStack([]);
    setProject(updater(activeProject));
  }
  function updateStep(patch: Partial<JourneyStep>) {
    commit((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === selected.id
          ? {
              ...step,
              ...patch,
              settings: (() => {
                const settings = { ...(step.settings || {}), ...(patch.settings || {}) };
                const generated = settings.generatedFields && typeof settings.generatedFields === "object"
                  ? { ...(settings.generatedFields as Record<string, unknown>) }
                  : undefined;
                if (generated) {
                  for (const key of Object.keys(patch)) delete generated[key];
                  settings.generatedFields = generated;
                }
                return settings;
              })(),
            }
          : step,
      ),
    }));
  }
  function reorder(direction: -1 | 1) {
    const index = activeProject.steps.findIndex(
      (step) => step.id === selected.id,
    );
    const target = index + direction;
    if (target < 0 || target >= activeProject.steps.length) return;
    const steps = [...activeProject.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    commit((current) => ({
      ...current,
      steps: steps.map((step, order) => ({ ...step, order })),
    }));
  }
  function duplicate() {
    const cloned = structuredClone(selected);
    cloned.id = uid("step");
    cloned.title += " — cópia";
    cloned.options = cloned.options?.map((option) => ({
      ...option,
      id: uid("option"),
    }));
    cloned.formFields = cloned.formFields?.map((field) => ({
      ...field,
      id: uid("field"),
    }));
    const index = activeProject.steps.findIndex(
      (step) => step.id === selected.id,
    );
    const steps = [...activeProject.steps];
    steps.splice(index + 1, 0, cloned);
    commit((current) => ({
      ...current,
      steps: steps.map((step, order) => ({ ...step, order })),
    }));
    setSelectedId(cloned.id);
  }
  function remove() {
    if (
      activeProject.steps.length === 1 ||
      !confirm(`Excluir a etapa “${selected.title}”?`)
    )
      return;
    const steps = activeProject.steps.filter((step) => step.id !== selected.id);
    commit((current) => ({
      ...current,
      steps: steps.map((step, order) => ({ ...step, order })),
    }));
    setSelectedId(steps[0].id);
  }
  function add(type: StepType) {
    const step = newStep(type, activeProject.steps.length);
    commit((current) => ({ ...current, steps: [...current.steps, step] }));
    setSelectedId(step.id);
    setAddOpen(false);
  }
  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((items) => [...items, structuredClone(activeProject)]);
    setUndoStack((items) => items.slice(0, -1));
    setProject(previous);
    setSelectedId(
      previous.steps.find((step) => step.id === selectedId)?.id ||
        previous.steps[0]?.id,
    );
  }
  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((items) => [...items, structuredClone(activeProject)]);
    setRedoStack((items) => items.slice(0, -1));
    setProject(next);
    setSelectedId(
      next.steps.find((step) => step.id === selectedId)?.id ||
        next.steps[0]?.id,
    );
  }
  async function publish() {
    setSaveState("saving");
    try {
      const saved = await projectRepository.saveProject(activeProject);
      setProject(saved);
      setSaveState("saved");
      setPublishOpen(true);
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="-m-4 flex min-h-[calc(100vh-73px)] flex-col bg-white sm:-m-6 lg:-m-8">
      <div className="flex min-h-[66px] flex-wrap items-center gap-3 border-b border-[#e5e4eb] px-4 py-2 sm:px-5">
        <Link
          href="/app/projects"
          className="focus-ring grid size-9 place-items-center rounded-xl text-[#676771] hover:bg-[#f0eff4]"
          aria-label="Voltar"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-extrabold">{project.name}</h1>
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-bold ${project.status === "published" ? "bg-[#e8f7ef] text-[#147b58]" : "bg-[#efeff3] text-[#666670]"}`}
            >
              {project.status === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#83838d]">
            {saveState === "saving" ? (
              <>
                <LoaderCircle size={11} className="animate-spin" /> Salvando…
              </>
            ) : saveState === "error" ? (
              "Erro ao salvar · tentar novamente"
            ) : (
              <>
                <Check size={11} /> Salvo
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!undoStack.length}
            className="focus-ring grid size-9 place-items-center rounded-xl text-[#6d6d77] hover:bg-[#f0eff4]"
            aria-label="Desfazer"
          >
            <Undo2 size={17} />
          </button>
          <button
            onClick={redo}
            disabled={!redoStack.length}
            className="focus-ring grid size-9 place-items-center rounded-xl text-[#6d6d77] hover:bg-[#f0eff4]"
            aria-label="Refazer"
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="hidden items-center rounded-xl bg-[#f0eff4] p-1 sm:flex">
          <button
            onClick={() => setMode("quick")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "quick" ? "bg-white shadow-sm" : "text-[#777781]"}`}
          >
            Rápido
          </button>
          <button
            onClick={() => setMode("advanced")}
            className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "advanced" ? "bg-white shadow-sm" : "text-[#777781]"}`}
          >
            Avançado
          </button>
        </div>
        <a
          href={`/${project.slug}/preview`}
          target="_blank"
          className="focus-ring hidden min-h-10 items-center gap-2 rounded-xl border border-[#dfdee6] px-3 text-xs font-bold sm:inline-flex"
        >
          <Eye size={16} /> Preview
        </a>
        <Button onClick={() => void publish()} size="sm">
          <Save size={15} />{" "}
          {project.status === "published" ? "Publicar alterações" : "Publicar"}
        </Button>
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 xl:grid-cols-[280px_minmax(390px,1fr)_360px]">
        <aside className="order-2 min-w-0 border-r border-[#e5e4eb] bg-[#fafafd] xl:order-1">
          <div className="flex items-center justify-between border-b border-[#e7e6ed] p-4">
            <div>
              <strong className="text-sm">Etapas</strong>
              <span className="ml-2 text-xs text-[#8a8a93]">
                {project.steps.length}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setAddOpen((value) => !value)}
                className="focus-ring grid size-9 place-items-center rounded-xl bg-[#17171c] text-white"
                aria-label="Adicionar etapa"
              >
                <Plus size={17} />
              </button>
              {addOpen && (
                <div className="absolute right-0 top-11 z-30 w-52 rounded-[16px] border border-[#dedde5] bg-white p-2 shadow-xl">
                  {(Object.keys(stepNames) as StepType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => add(type)}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-[#f1f0f5]"
                    >
                      {stepNames[type]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="max-h-[430px] space-y-2 overflow-y-auto p-3 scrollbar-thin xl:max-h-[calc(100vh-207px)]">
            {project.steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setSelectedId(step.id)}
                className={`focus-ring flex w-full items-center gap-3 rounded-[15px] border p-3 text-left transition ${step.id === selected.id ? "border-[#8c82e9] bg-[#efedff]" : "border-transparent bg-white hover:border-[#dedde5]"}`}
              >
                <span
                  className={`grid size-8 place-items-center rounded-[10px] text-xs font-extrabold ${step.id === selected.id ? "bg-[#6d5ef5] text-white" : "bg-[#eeedf2] text-[#6c6c76]"}`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">
                    {step.title}
                  </strong>
                  <small className="mt-0.5 block text-[10px] text-[#85858e]">
                    {stepNames[step.type]}
                  </small>
                </span>
                <span
                  className={`size-1.5 rounded-full ${step.isActive ? "bg-[#22a675]" : "bg-[#aaa9b2]"}`}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border-t border-[#e5e4eb] p-3">
            <button
              onClick={() => reorder(-1)}
              className="focus-ring grid size-9 place-items-center rounded-xl hover:bg-white"
              title="Mover para cima"
            >
              <ArrowUp size={16} />
            </button>
            <button
              onClick={() => reorder(1)}
              className="focus-ring grid size-9 place-items-center rounded-xl hover:bg-white"
              title="Mover para baixo"
            >
              <ArrowDown size={16} />
            </button>
            <button
              onClick={duplicate}
              className="focus-ring grid size-9 place-items-center rounded-xl hover:bg-white"
              title="Duplicar"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={remove}
              className="focus-ring ml-auto grid size-9 place-items-center rounded-xl text-[#bd4141] hover:bg-[#fff0f0]"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </aside>
        <section className="order-1 flex min-h-[720px] min-w-0 items-center justify-center overflow-hidden bg-[#efedf4] p-5 xl:order-2 xl:min-h-0">
          <div className="relative w-full max-w-[390px]">
            <div className="mb-3 flex items-center justify-between gap-3 text-xs font-semibold text-[#777781]">
              <span className="inline-flex items-center gap-2">
                <Smartphone size={15} /> Preview mobile
              </span>
              <label className="flex items-center gap-2">Preview como<select aria-label="Preview como" value={previewAs} onChange={(event) => setPreviewAs(event.target.value)} className="min-h-9 rounded-lg border border-[#d9d6df] bg-white px-2 text-[11px]"><option value="bio">Bio</option>{project.entryPoints?.map((entry) => <option key={entry.id} value={`entry:${entry.key}`}>{entry.name}</option>)}{project.conversionGoals?.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.name}</option>)}</select></label>
            </div>
            <div className="h-[680px] overflow-hidden rounded-[38px] border-[7px] border-[#222126] bg-white p-1.5 shadow-[0_30px_80px_rgba(29,25,55,.2)]">
              <div className="h-full overflow-hidden rounded-[28px]">
                <ExperienceCanvas
                  key={`${project.id}-${project.version}-${previewAs}`}
                  project={project}
                  preview
                  previewEntryKey={previewAs.startsWith("entry:") ? previewAs.slice(6) : undefined}
                  previewGoalId={previewAs.startsWith("goal:") ? previewAs.slice(5) : undefined}
                />
              </div>
            </div>
          </div>
        </section>
        <aside className="order-3 min-w-0 border-l border-[#e5e4eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e7e6ed] px-5 py-4">
            <div>
              <strong className="block text-sm">
                {stepNames[selected.type]}
              </strong>
              <span className="text-[10px] text-[#888892]">
                Etapa {selected.order + 1}
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={selected.isActive}
                onChange={(event) =>
                  updateStep({ isActive: event.target.checked })
                }
                className="accent-[#6d5ef5]"
              />{" "}
              Ativa
            </label>
          </div>
          <div className="max-h-[700px] overflow-y-auto p-5 scrollbar-thin xl:max-h-[calc(100vh-140px)]">
            <CapabilityPanel
              project={activeProject}
              onChange={(next) => commit(() => next)}
            />
            <AIScopeActions
              project={activeProject}
              step={selected}
              onApplyStep={(next) => updateStep(next)}
              onApplyVisual={(designSystem, visualDirection) => commit((current) => ({ ...current, designSystem, visualDirection, version: current.version + 1 }))}
            />
            <div>
              <Label htmlFor="step-title">Título</Label>
              <Textarea
                id="step-title"
                value={selected.title}
                onChange={(event) => updateStep({ title: event.target.value })}
                className="min-h-24"
              />
              <AIFieldActions projectId={project.id} stepId={selected.id} fieldPath={`steps.${selected.id}.title`} currentValue={selected.title} onApply={(title) => updateStep({ title })} />
            </div>
            <div className="mt-5">
              <Label htmlFor="step-description">Descrição</Label>
              <Textarea
                id="step-description"
                value={selected.description || ""}
                onChange={(event) =>
                  updateStep({ description: event.target.value })
                }
              />
              <AIFieldActions projectId={project.id} stepId={selected.id} fieldPath={`steps.${selected.id}.description`} currentValue={selected.description || ""} onApply={(description) => updateStep({ description })} />
            </div>
            {selected.options && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <Label>Opções</Label>
                  <button
                    onClick={() =>
                      updateStep({
                        options: [
                          ...(selected.options || []),
                          {
                            id: uid("option"),
                            label: "Nova opção",
                            value: "nova-opcao",
                            actionType: "finish",
                          },
                        ],
                      })
                    }
                    className="mb-2 text-xs font-bold text-[#6053d5]"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="space-y-3">
                  {selected.options.map((option, optionIndex) => (
                    <div
                      key={option.id}
                      className="rounded-[15px] border border-[#e3e2e9] bg-[#fafafd] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-lg bg-[#e9e6ff] text-[10px] font-extrabold text-[#5d4fd2]">
                          {optionIndex + 1}
                        </span>
                        <Input
                          value={option.label}
                          onChange={(event) =>
                            updateStep({
                              options: selected.options?.map((item) =>
                                item.id === option.id
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            })
                          }
                          className="min-h-9 flex-1 text-xs"
                        />
                        <button
                          onClick={() =>
                            updateStep({
                              options: selected.options?.filter(
                                (item) => item.id !== option.id,
                              ),
                            })
                          }
                          className="text-[#b84545]"
                          aria-label="Remover opção"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mt-2">
                        <span className="mb-1 block text-[10px] font-bold text-[#777781]">
                          Ao clicar, ir para…
                        </span>
                        <Select
                          value={
                            option.actionType === "go_to_step"
                              ? option.targetStepId || ""
                              : option.actionType === "start_capability"
                                ? `capability:${String(option.actionPayload?.capability || "qualification")}`
                              : option.actionType
                          }
                          onChange={(event) => {
                            const value = event.target.value;
                            const isStep = project.steps.some(
                              (item) => item.id === value,
                            );
                            const capability = value.startsWith("capability:")
                              ? value.replace("capability:", "")
                              : undefined;
                            updateStep({
                              options: selected.options?.map((item) =>
                                item.id === option.id
                                  ? {
                                      ...item,
                                      actionType: isStep
                                        ? "go_to_step"
                                        : capability
                                          ? "start_capability"
                                          : (value as typeof option.actionType),
                                      targetStepId: isStep ? value : undefined,
                                      actionPayload: (capability
                                        ? { capability }
                                        : value === "open_whatsapp"
                                          ? (() => {
                                              const destination = project.commercialConfig?.routingDestinations?.find((candidate) => candidate.type === "whatsapp");
                                              return {
                                                ...(destination ? { destinationId: destination.id, phone: destination.value || "" } : { phone: project.phone || "" }),
                                                message: "",
                                              };
                                            })()
                                          : value === "open_url"
                                            ? { url: "" }
                                            : undefined) as Record<string, string | number | boolean> | undefined,
                                    }
                                  : item,
                              ),
                            });
                          }}
                          className="min-h-9 text-xs"
                        >
                          <option value="finish">Encerrar jornada</option>
                          <option value="open_whatsapp">WhatsApp</option>
                          <option value="open_url">Link externo</option>
                          <option value="submit_form">Capturar lead</option>
                          {(project.capabilities || [])
                            .filter((item) => item.enabled)
                            .map((item) => (
                              <option key={item.key} value={`capability:${item.key}`}>
                                Iniciar {item.key.replaceAll("_", " ")}
                              </option>
                            ))}
                          {project.steps
                            .filter((item) => item.id !== selected.id)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                Etapa {item.order + 1}: {item.title}
                              </option>
                            ))}
                        </Select>
                      </div>
                      {option.actionType === "open_url" ? (
                        <div className="mt-3">
                          <Label htmlFor={`option-url-${option.id}`}>URL de destino</Label>
                          <Input
                            id={`option-url-${option.id}`}
                            type="url"
                            placeholder="https://exemplo.com"
                            value={String(option.actionPayload?.url || "")}
                            onChange={(event) => updateStep({ options: selected.options?.map((item) => item.id === option.id ? { ...item, actionPayload: { ...(item.actionPayload || {}), url: event.target.value } } : item) })}
                          />
                          {option.actionPayload?.url && !/^https?:\/\//i.test(String(option.actionPayload.url)) ? <p className="mt-1 text-xs font-semibold text-red-600">Use uma URL completa iniciada por http:// ou https://.</p> : null}
                        </div>
                      ) : null}
                      {option.actionType === "open_whatsapp" ? (
                        <div className="mt-3 grid gap-3">
                          {(project.commercialConfig?.routingDestinations || []).some((destination) => destination.type === "whatsapp") ? <div><Label htmlFor={`option-destination-${option.id}`}>Destino configurado</Label><Select id={`option-destination-${option.id}`} value={String(option.actionPayload?.destinationId || "")} onChange={(event) => { const destination = project.commercialConfig?.routingDestinations?.find((item) => item.id === event.target.value); updateStep({ options: selected.options?.map((item) => item.id === option.id ? { ...item, actionPayload: { ...(item.actionPayload || {}), destinationId: destination?.id || "", phone: destination?.value || String(item.actionPayload?.phone || "") } } : item) }); }}><option value="">Telefone manual</option>{(project.commercialConfig?.routingDestinations || []).filter((destination) => destination.type === "whatsapp").map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}</Select></div> : null}
                          <div><div className="mb-2 flex items-center justify-between"><Label htmlFor={`option-phone-${option.id}`}>Telefone</Label>{project.phone ? <button type="button" className="text-xs font-bold text-[#6053d5]" onClick={() => updateStep({ options: selected.options?.map((item) => item.id === option.id ? { ...item, actionPayload: { ...(item.actionPayload || {}), phone: project.phone || "", destinationId: "" } } : item) })}>Usar padrão</button> : null}</div><Input id={`option-phone-${option.id}`} inputMode="tel" placeholder="5511999999999" value={String(option.actionPayload?.phone || "")} onChange={(event) => updateStep({ options: selected.options?.map((item) => item.id === option.id ? { ...item, actionPayload: { ...(item.actionPayload || {}), phone: event.target.value, destinationId: "" } } : item) })} /></div>
                          <div><Label htmlFor={`option-message-${option.id}`}>Mensagem inicial</Label><Textarea id={`option-message-${option.id}`} className="min-h-20" placeholder="Olá! Quero saber mais." value={String(option.actionPayload?.message || "")} onChange={(event) => updateStep({ options: selected.options?.map((item) => item.id === option.id ? { ...item, actionPayload: { ...(item.actionPayload || {}), message: event.target.value } } : item) })} /></div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.type === "form" ? (
              <FormBuilder project={activeProject} step={selected} onChange={(next) => updateStep(next)} />
            ) : null}
            {selected.recommendation && (
              <div className="mt-6 rounded-[16px] border border-[#e3e2e9] p-4">
                <Label>Título da recomendação</Label>
                <Input
                  value={selected.recommendation.title}
                  onChange={(event) =>
                    updateStep({
                      recommendation: {
                        ...selected.recommendation!,
                        title: event.target.value,
                      },
                    })
                  }
                />
                <div className="mt-4">
                  <Label>Descrição</Label>
                  <Textarea
                    value={selected.recommendation.description}
                    onChange={(event) =>
                      updateStep({
                        recommendation: {
                          ...selected.recommendation!,
                          description: event.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
            <BlockEditor
              step={selected}
              project={activeProject}
              mode={mode}
              onChange={(next) => updateStep(next)}
            />
            {(
              <div className="mt-7 border-t border-[#e5e4eb] pt-6">
                <div className="flex items-center gap-2">
                  <Palette size={17} className="text-[#6255d8]" />
                  <h3 className="text-sm font-extrabold">
                    Design da experiência
                  </h3>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Presets visuais">
                  {[
                    { name: "Minimal", colors: ["#17171c", "#f7f7f8"], heading: "Inter", radius: 10 },
                    { name: "Editorial", colors: ["#5946c8", "#fbf8f2"], heading: "DM Sans", radius: 4 },
                    { name: "Expressivo", colors: ["#6d3df2", "#f4f0ff"], heading: "Sora", radius: 24 },
                  ].map((preset) => <button key={preset.name} type="button" onClick={() => commit((current) => ({ ...current, designSystem: { ...current.designSystem, colors: ensureAccessiblePalette(buildPalette(preset.colors)), typography: { ...current.designSystem.typography, headingFont: preset.heading }, shape: { ...current.designSystem.shape, cardRadius: preset.radius, buttonRadius: preset.radius } } }))} className="min-h-10 rounded-xl border border-[#dfdee7] bg-white px-2 text-[11px] font-bold hover:border-[#8f84f7]">{preset.name}</button>)}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["primary", "background", "surface"].map((key) => (
                    <label
                      key={key}
                      className="text-[10px] font-bold capitalize text-[#73737d]"
                    >
                      {key}
                      <input
                        type="color"
                        value={
                          project.designSystem.colors[
                            key as "primary" | "background" | "surface"
                          ]
                        }
                        onChange={(event) =>
                          commit((current) => ({
                            ...current,
                            designSystem: {
                              ...current.designSystem,
                              colors: ensureAccessiblePalette({
                                ...current.designSystem.colors,
                                [key]: event.target.value,
                              }),
                            },
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-[#dedde5] bg-white p-1"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-5">
                  <Label htmlFor="font">Tipografia de títulos</Label>
                  <Select
                    id="font"
                    value={project.designSystem.typography.headingFont}
                    onChange={(event) =>
                      commit((current) => ({
                        ...current,
                        designSystem: {
                          ...current.designSystem,
                          typography: {
                            ...current.designSystem.typography,
                            headingFont: event.target.value,
                          },
                        },
                      }))
                    }
                  >
                    {[
                      "Inter",
                      "Manrope",
                      "Plus Jakarta Sans",
                      "Poppins",
                      "Sora",
                      "DM Sans",
                      "Outfit",
                    ].map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </Select>
                </div>
                <div className="mt-5">
                  <Label htmlFor="body-font">Tipografia do corpo</Label>
                  <Select id="body-font" value={project.designSystem.typography.bodyFont} onChange={(event) => commit((current) => ({ ...current, designSystem: { ...current.designSystem, typography: { ...current.designSystem.typography, bodyFont: event.target.value } } }))}>
                    {["Inter", "Manrope", "Plus Jakarta Sans", "Poppins", "Sora", "DM Sans", "Outfit"].map((font) => <option key={font}>{font}</option>)}
                  </Select>
                </div>
                <div className="mt-5">
                  <Label htmlFor="buttons">Estilo dos botões</Label>
                  <Select id="buttons" value={project.designSystem.buttons.style} onChange={(event) => commit((current) => ({ ...current, designSystem: { ...current.designSystem, buttons: { ...current.designSystem.buttons, style: event.target.value as Project["designSystem"]["buttons"]["style"] } } }))}>
                    <option value="solid">Sólido</option><option value="outline">Contornado</option><option value="soft">Suave</option><option value="glass">Translúcido</option><option value="gradient">Gradiente</option>
                  </Select>
                </div>
                <div className="mt-5">
                  <div className="flex justify-between">
                    <Label htmlFor="radius">Raio dos cards</Label>
                    <span className="text-xs text-[#85858e]">
                      {project.designSystem.shape.cardRadius}px
                    </span>
                  </div>
                  <input
                    id="radius"
                    type="range"
                    min="4"
                    max="36"
                    value={project.designSystem.shape.cardRadius}
                    onChange={(event) =>
                      commit((current) => ({
                        ...current,
                        designSystem: {
                          ...current.designSystem,
                          shape: {
                            ...current.designSystem.shape,
                            cardRadius: Number(event.target.value),
                          },
                        },
                      }))
                    }
                    className="w-full accent-[#6d5ef5]"
                  />
                </div>
                <div className="mt-5">
                  <Label htmlFor="cards">Estilo dos cards</Label>
                  <Select
                    id="cards"
                    value={project.designSystem.cards.style}
                    onChange={(event) =>
                      commit((current) => ({
                        ...current,
                        designSystem: {
                          ...current.designSystem,
                          cards: {
                            ...current.designSystem.cards,
                            style: event.target
                              .value as Project["designSystem"]["cards"]["style"],
                          },
                        },
                      }))
                    }
                  >
                    <option value="flat">Plano</option>
                    <option value="outlined">Contornado</option>
                    <option value="elevated">Elevado</option>
                    <option value="glass">Glass</option>
                    <option value="gradient">Gradiente</option>
                  </Select>
                </div>
                <button
                  onClick={() =>
                    commit((current) => ({
                      ...current,
                      designSystem: {
                        ...current.designSystem,
                        colors: buildPalette(current.brand.extractedColors),
                      },
                    }))
                  }
                  className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#6255d8]"
                >
                  <Sparkles size={14} /> Restaurar sugestão automática
                </button>
              </div>
            )}
            <div className="mt-7 grid grid-cols-2 gap-2">
              <Link
                href={`/app/projects/${project.id}/operations`}
                className="focus-ring col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17171c] text-xs font-bold text-white"
              >
                <Layers3 size={15} /> Operação comercial
              </Link>
              <Link
                href={`/app/projects/${project.id}/brand`}
                className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfdee6] text-xs font-bold"
              >
                <Settings2 size={15} /> Marca
              </Link>
              <a
                href={`/${project.slug}`}
                target="_blank"
                className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfdee6] text-xs font-bold"
              >
                Página <ExternalLink size={15} />
              </a>
            </div>
          </div>
        </aside>
      </div>
      <PublishReadinessModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        project={activeProject}
        onPublished={(published) => {
          setProject(published);
          if (canUseLocalStore()) localStore.saveProject(published);
          setSaveState("saved");
        }}
      />
    </div>
  );
}
