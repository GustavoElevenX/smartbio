"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  LoaderCircle,
  Monitor,
  Monitor as Desktop,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brand } from "@/components/ui/brand";
import { PublishReadinessModal } from "@/components/publishing/publish-readiness-modal";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { projectRepository } from "@/lib/repositories/project-repository";
import {
  createPresencePage,
  createPresenceSection,
  duplicatePresencePage,
} from "@/features/presence/presence-page-service";
import {
  deletePresencePage,
  PresencePageConflictError,
  savePresencePage,
} from "@/features/presence/presence-page-repository";
import { presenceSectionRegistry } from "@/features/presence/section-registry";
import { getPresenceReadinessIssues } from "@/features/presence/presence-readiness";
import type { AIPresenceDraft } from "@/features/presence/ai-presence.schema";
import type {
  PresencePage,
  PresenceSection,
  PresenceSectionType,
} from "@/features/presence/presence.types";
import type { Project } from "@/types";
import { SectionInspector } from "./section-editor-registry";
import { SimpleSectionInspector } from "./simple-section-inspector";
import type { SiteComposerIntent, SiteOperation, SuggestedSiteStructure } from "@/features/site-composer/site-composer.types";
import { inspectPageQuality } from "@/features/site-composer/site-quality";

type SaveState = "saved" | "dirty" | "saving" | "error";
type Device = "desktop" | "tablet" | "mobile";
type MobilePanel = "pages" | "sections" | "properties";
export type SiteEditorMode = "simple" | "advanced";
const viewport = { desktop: 1120, tablet: 768, mobile: 390 };
type AIProposal = {
  kind: "page" | "section";
  draft: AIPresenceDraft;
  targetSectionId?: string;
};
type StructureProposal = { proposalId: string; suggestion: SuggestedSiteStructure; operations: SiteOperation[]; expectedVersion: number; usedAI: boolean };
type PerformanceState = { evidence: { eligible: boolean; completeDays: number; daysProgress: number; sessionsProgress: number; goalSessionsProgress?: number; message: string } | null; suggestions: Array<{ id: string; title: string; explanation: string }>; publishedAt?: string; primaryGoalName?: string };
type PerformanceExplanation = { explanation: string; recommendedAction: string; usedAI: boolean };

const copilotActions: Array<{ intent: SiteComposerIntent; label: string }> = [
  { intent: "suggest_structure", label: "Melhorar a estrutura da página" },
  { intent: "create_page", label: "Criar uma nova página" },
  { intent: "add_section", label: "Adicionar conteúdo" },
  { intent: "reorganize", label: "Organizar melhor esta página" },
  { intent: "improve_cta", label: "Melhorar os botões e chamadas" },
  { intent: "focus_offer", label: "Dar mais destaque ao que eu vendo" },
  { intent: "create_landing", label: "Criar uma página para campanha" },
];

function operationDescription(operation: SiteOperation) {
  if (operation.type === "add_page") return `Criar página “${operation.page.name}”`;
  if (operation.type === "add_section") return `Adicionar ${presenceSectionRegistry[operation.section.sectionType].label}`;
  if (operation.type === "remove_section") return "Remover seção redundante";
  if (operation.type === "move_section") return `Mover seção para a posição ${operation.to + 1}`;
  if (operation.type === "update_section") return "Atualizar conteúdo, visual e fontes";
  if (operation.type === "rename_page") return `Renomear página para “${operation.name}”`;
  return "Conectar objetivo de conversão";
}

function operationSymbol(operation: SiteOperation) {
  if (operation.type === "add_page" || operation.type === "add_section") return "+";
  if (operation.type === "remove_section") return "−";
  if (operation.type === "move_section") return "↕";
  return "~";
}

const sectionLibraryGroups: Array<{ label: string; types: PresenceSectionType[] }> = [
  { label: "Apresentar", types: ["hero", "about", "rich_text", "video"] },
  { label: "Mostrar oferta", types: ["products", "services", "pricing", "gallery", "portfolio"] },
  { label: "Construir confiança", types: ["benefits", "feature_grid", "stats", "logo_cloud", "testimonials", "faq"] },
  { label: "Converter", types: ["conversion_cta", "contact", "locations", "divider"] },
];

function SectionLibrary({ onAdd }: { onAdd(type: PresenceSectionType): void }) {
  return <div className="mt-2 flex flex-col gap-3">{sectionLibraryGroups.map((group) => <div key={group.label}><p className="mb-1 text-[10px] font-black uppercase tracking-[.1em] text-[#87909c]">{group.label}</p><div className="grid grid-cols-2 gap-1">{group.types.map((type) => <button type="button" key={type} onClick={() => onAdd(type)} className="min-h-10 rounded-lg p-2 text-left text-[11px] font-bold hover:bg-[#eef6ff]">{presenceSectionRegistry[type].label}</button>)}</div></div>)}</div>;
}

function MobileDrawer({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return <><button type="button" aria-label="Fechar painel" onClick={onClose} className="fixed inset-0 z-40 bg-[#101827]/45 xl:hidden" /><section role="dialog" aria-modal="true" aria-label={title} className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-[0_-20px_70px_rgba(15,23,42,.28)] xl:hidden"><div className="mb-4 flex items-center justify-between"><strong className="text-sm font-black">{title}</strong><Button size="icon" variant="ghost" aria-label={`Fechar ${title.toLowerCase()}`} onClick={onClose}><X size={16} /></Button></div>{children}</section></>;
}

function materializeAISection(
  draft: AIPresenceDraft["sections"][number],
  pageId: string,
  order: number,
  id = crypto.randomUUID(),
): PresenceSection {
  return {
    id,
    pageId,
    key: `${draft.type}-${crypto.randomUUID().slice(0, 8)}`,
    type: draft.type,
    anchor: draft.anchor,
    eyebrow: draft.eyebrow,
    title: draft.title,
    description: draft.description,
    content: draft.content,
    style: draft.style,
    settings: {
      contentMeta: {
        generatedByAI: true,
        sourceIds: draft.sourceIds,
        verificationStatus: draft.verificationStatus,
      },
    },
    order,
    isActive: true,
  };
}

export function SiteEditor({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<SiteEditorMode>("simple");
  const [project, setProject] = useState<Project | null>();
  const [pages, setPages] = useState<PresencePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [device, setDevice] = useState<Device>("desktop");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>();
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIProposal>();
  const [structureProposal, setStructureProposal] = useState<StructureProposal>();
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiIntent, setAiIntent] = useState<SiteComposerIntent>("suggest_structure");
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [customizingProposal, setCustomizingProposal] = useState(false);
  const [performance, setPerformance] = useState<PerformanceState>();
  const [performanceExplanations, setPerformanceExplanations] = useState<Record<string, PerformanceExplanation>>({});
  const [performanceLoadingId, setPerformanceLoadingId] = useState<string>();
  const [aiError, setAiError] = useState("");
  const [undo, setUndo] = useState<PresencePage[][]>([]);
  const [redo, setRedo] = useState<PresencePage[][]>([]);
  const deletedSectionIds = useRef<string[]>([]);
  const draggedSectionId = useRef<string | undefined>(undefined);

  useEffect(() => {
    void projectRepository
      .getProject(projectId)
      .then((found) => {
        setProject(found || null);
        const initial = found?.presence?.pages || [];
        setPages(initial);
        setSelectedPageId(
          initial.find((page) => page.isHome)?.id || initial[0]?.id || "",
        );
      })
      .catch(() => setProject(null));
  }, [projectId]);
  const performanceProjectId = project?.id;
  const performancePublishedAt = project?.publishedAt;
  useEffect(() => {
    if (!performanceProjectId) return;
    void fetch(`/api/projects/${performanceProjectId}/optimization`).then((response) => response.json()).then((payload: { data?: PerformanceState }) => setPerformance(payload.data)).catch(() => setPerformance(undefined));
  }, [performanceProjectId, performancePublishedAt]);
  const activePage = pages.find((page) => page.id === selectedPageId);
  const activeSection = activePage?.sections.find(
    (section) => section.id === selectedSectionId,
  );
  const qualityWarnings = useMemo(() => activePage ? inspectPageQuality(activePage) : [], [activePage]);
  const previewProject = useMemo(
    () => (project ? { ...project, presence: { pages } } : null),
    [pages, project],
  );

  const commit = useCallback(
    (next: PresencePage[], sectionId?: string) => {
      setUndo((history) => [...history.slice(-39), structuredClone(pages)]);
      setRedo([]);
      setPages(next);
      setSaveState("dirty");
      setMessage("");
      if (sectionId !== undefined) setSelectedSectionId(sectionId || undefined);
    },
    [pages],
  );
  function updatePage(page: PresencePage) {
    commit(pages.map((item) => (item.id === page.id ? page : item)));
  }
  function updateSection(section: PresenceSection) {
    if (activePage)
      updatePage({
        ...activePage,
        sections: activePage.sections.map((item) =>
          item.id === section.id ? section : item,
        ),
      });
  }

  const persist = useCallback(
    async (page: PresencePage) => {
      if (!project) return;
      setSaveState("saving");
      setMessage("");
      try {
        const saved = await savePresencePage(
          { ...project, presence: { pages } },
          page,
          deletedSectionIds.current,
        );
        deletedSectionIds.current = [];
        setPages((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
        setProject((current) =>
          current
            ? {
                ...current,
                presence: {
                  pages: pages.map((item) =>
                    item.id === saved.id ? saved : item,
                  ),
                },
              }
            : current,
        );
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setMessage(
          error instanceof PresencePageConflictError
            ? "Esta página mudou em outra sessão. Recarregue para evitar sobrescrever alterações."
            : error instanceof Error
              ? error.message
              : "Não foi possível salvar.",
        );
      }
    },
    [pages, project],
  );
  useEffect(() => {
    if (saveState !== "dirty" || !activePage) return;
    const timer = window.setTimeout(() => void persist(activePage), 900);
    return () => clearTimeout(timer);
  }, [activePage, persist, saveState]);

  function undoChange() {
    const previous = undo.at(-1);
    if (!previous) return;
    setRedo((items) => [...items, structuredClone(pages)]);
    setUndo((items) => items.slice(0, -1));
    setPages(previous);
    setSaveState("dirty");
  }
  function redoChange() {
    const next = redo.at(-1);
    if (!next) return;
    setUndo((items) => [...items, structuredClone(pages)]);
    setRedo((items) => items.slice(0, -1));
    setPages(next);
    setSaveState("dirty");
  }
  function addPage(type: PresencePage["type"] = "page") {
    if (!project) return;
    const page = createPresencePage(
      project.id,
      type === "home"
        ? "Início"
        : type === "landing"
          ? "Nova landing page"
          : "Nova página",
      type,
      pages,
    );
    commit([...pages, page]);
    setSelectedPageId(page.id);
    setSelectedSectionId(page.sections[0]?.id);
    setPageMenuOpen(false);
  }
  function duplicatePage() {
    if (!activePage) return;
    const copy = duplicatePresencePage(activePage, pages);
    commit([...pages, copy]);
    setSelectedPageId(copy.id);
    setSelectedSectionId(copy.sections[0]?.id);
  }
  async function removePage() {
    if (!project || !activePage) return;
    try {
      const updated = await deletePresencePage(
        { ...project, presence: { pages } },
        activePage.id,
      );
      const next = pages.filter((page) => page.id !== activePage.id);
      setProject(updated);
      setPages(next);
      setSelectedPageId(next[0]?.id || "");
      setSelectedSectionId(undefined);
      setSaveState("saved");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a página.",
      );
    }
  }
  function addSection(type: PresenceSectionType) {
    if (!activePage) return;
    const section = createPresenceSection(
      activePage.id,
      type,
      activePage.sections.length,
    );
    updatePage({ ...activePage, sections: [...activePage.sections, section] });
    setSelectedSectionId(section.id);
  }
  function removeSection() {
    if (!activePage || !activeSection) return;
    deletedSectionIds.current.push(activeSection.id);
    const sections = activePage.sections
      .filter((section) => section.id !== activeSection.id)
      .map((section, order) => ({ ...section, order }));
    commit(
      pages.map((page) =>
        page.id === activePage.id ? { ...page, sections } : page,
      ),
      "",
    );
  }
  function duplicateSection() {
    if (!activePage || !activeSection) return;
    const duplicate = {
      ...structuredClone(activeSection),
      id: crypto.randomUUID(),
      key: `${activeSection.type}-${crypto.randomUUID().slice(0, 8)}`,
      order: activeSection.order + 1,
    };
    const sections = activePage.sections
      .flatMap((section) =>
        section.id === activeSection.id ? [section, duplicate] : [section],
      )
      .map((section, order) => ({ ...section, order }));
    commit(
      pages.map((page) =>
        page.id === activePage.id ? { ...page, sections } : page,
      ),
      duplicate.id,
    );
  }
  function moveSection(id: string, direction: -1 | 1) {
    if (!activePage) return;
    const sections = activePage.sections.toSorted((a, b) => a.order - b.order);
    const index = sections.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    updatePage({
      ...activePage,
      sections: sections.map((section, order) => ({ ...section, order })),
    });
  }
  function dropSection(targetId: string) {
    if (
      !activePage ||
      !draggedSectionId.current ||
      draggedSectionId.current === targetId
    )
      return;
    const sections = activePage.sections.toSorted((a, b) => a.order - b.order);
    const from = sections.findIndex(
      (section) => section.id === draggedSectionId.current,
    );
    const to = sections.findIndex((section) => section.id === targetId);
    const [moved] = sections.splice(from, 1);
    sections.splice(to, 0, moved);
    draggedSectionId.current = undefined;
    updatePage({
      ...activePage,
      sections: sections.map((section, order) => ({ ...section, order })),
    });
  }
  async function requestAI(kind: "page" | "section") {
    if (!project || !activePage) return;
    setAiLoading(true);
    setAiError("");
    const endpoint =
      kind === "section" && activeSection
        ? `/api/ai/projects/${project.id}/presence/sections/${activeSection.id}/improve`
        : `/api/ai/projects/${project.id}/presence/generate`;
    const body =
      kind === "section" && activeSection
        ? {
            scope: "copy",
            instruction:
              "Melhore clareza, concisão e força comercial sem inventar fatos.",
            sectionType: activeSection.type,
            projectSnapshot: { ...project, presence: { pages } },
          }
        : {
            type:
              activePage.type === "landing" ? "landing_page" : "business_site",
            instruction:
              "Reorganize a página para apresentar o negócio e conduzir a uma ação comercial mensurável.",
            projectSnapshot: { ...project, presence: { pages } },
          };
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        data?: { proposal?: AIPresenceDraft };
        error?: { message?: string };
      };
      if (!response.ok || !payload.data?.proposal)
        throw new Error(
          payload.error?.message || "A IA não retornou uma proposta válida.",
        );
      setAiProposal({
        kind,
        draft: payload.data.proposal,
        targetSectionId: activeSection?.id,
      });
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar a proposta.",
      );
    } finally {
      setAiLoading(false);
    }
  }
  async function requestStructure(intent: SiteComposerIntent = aiIntent, instructionOverride?: string) {
    if (!project) return;
    setAiLoading(true);
    setAiError("");
    try {
      const target = ["suggest_structure", "create_page", "create_landing"].includes(intent) ? "site" : "page";
      const instruction = instructionOverride?.trim() || aiInstruction.trim() || copilotActions.find((action) => action.intent === intent)?.label || "Organize o site para conduzir ao objetivo comercial principal.";
      const response = await fetch(`/api/ai/projects/${project.id}/site/suggest-structure`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ instruction, intent, target, pageId: target === "page" ? activePage?.id : undefined }) });
      const payload = await response.json() as { data?: StructureProposal; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message || "Não foi possível sugerir a estrutura.");
      setStructureProposal(payload.data);
      setSelectedOperationIds(new Set(payload.data.operations.map((operation) => operation.id)));
      setCustomizingProposal(false);
    } catch (error) { setAiError(error instanceof Error ? error.message : "Não foi possível sugerir a estrutura."); }
    finally { setAiLoading(false); }
  }
  async function explainPerformanceSuggestion(suggestionId: string) {
    if (!project) return;
    setPerformanceLoadingId(suggestionId);
    setAiError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/optimization/explain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ suggestionId }) });
      const payload = await response.json() as { data?: PerformanceExplanation; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "Não foi possível explicar esta evidência.");
      setPerformanceExplanations((current) => ({ ...current, [suggestionId]: payload.data! }));
    } catch (error) { setAiError(error instanceof Error ? error.message : "Não foi possível explicar esta evidência."); }
    finally { setPerformanceLoadingId(undefined); }
  }
  async function applyStructureProposal() {
    if (!project || !structureProposal) return;
    setAiLoading(true);
    try {
      const selectedOperations = [...selectedOperationIds];
      if (!selectedOperations.length) throw new Error("Selecione pelo menos uma operação para aplicar.");
      const response = await fetch(`/api/projects/${project.id}/site/apply-proposal`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposalId: structureProposal.proposalId, selectedOperations, expectedVersion: structureProposal.expectedVersion }) });
      const payload = await response.json() as { data?: { pages?: PresencePage[] }; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Não foi possível aplicar a proposta.");
      if (payload.data?.pages?.length) {
        const changedPages = payload.data.pages;
        setPages((current) => {
          const changedById = new Map(changedPages.map((page) => [page.id, page]));
          const next = current.map((page) => changedById.get(page.id) || page);
          for (const page of changedPages) if (!next.some((candidate) => candidate.id === page.id)) next.push(page);
          setProject((currentProject) => currentProject ? { ...currentProject, presence: { pages: next } } : currentProject);
          return next;
        });
      } else {
        const refreshed = await projectRepository.getProject(project.id);
        if (refreshed) { setProject(refreshed); setPages(refreshed.presence?.pages || []); }
      }
      setStructureProposal(undefined);
      setMessage("Proposta aplicada somente ao rascunho. Revise antes de publicar.");
    } catch (error) { setAiError(error instanceof Error ? error.message : "Não foi possível aplicar a proposta."); }
    finally { setAiLoading(false); }
  }
  function applyAIProposal() {
    if (!aiProposal || !activePage) return;
    if (aiProposal.kind === "section" && aiProposal.targetSectionId) {
      const current = activePage.sections.find(
        (section) => section.id === aiProposal.targetSectionId,
      );
      const suggested = aiProposal.draft.sections.find(
        (section) => section.type === current?.type,
      );
      if (!current || !suggested) {
        setAiError("A proposta não contém uma seção compatível.");
        return;
      }
      updatePage({
        ...activePage,
        sections: activePage.sections.map((section) =>
          section.id === current.id
            ? materializeAISection(
                suggested,
                activePage.id,
                section.order,
                section.id,
              )
            : section,
        ),
      });
    } else {
      updatePage({
        ...activePage,
        name: aiProposal.draft.page.name,
        title: aiProposal.draft.page.title,
        description: aiProposal.draft.page.description,
        seoTitle: aiProposal.draft.page.seoTitle,
        seoDescription: aiProposal.draft.page.seoDescription,
        sections: aiProposal.draft.sections.map((section, order) =>
          materializeAISection(section, activePage.id, order),
        ),
      });
    }
    setAiProposal(undefined);
    setMessage(
      "Proposta da IA aplicada ao rascunho. Revise antes de publicar.",
    );
  }

  if (project === undefined)
    return (
      <div className="grid min-h-[560px] place-items-center">
        <div
          role="status"
          className="flex items-center gap-2 text-sm font-bold text-[#706d78]"
        >
          <LoaderCircle className="animate-spin" />
          Carregando editor do site…
        </div>
      </div>
    );
  if (!project)
    return (
      <div className="grid min-h-[560px] place-items-center text-center">
        <div>
          <h1 className="text-2xl font-black">Projeto não encontrado</h1>
          <p className="mt-2 text-sm text-[#706d78]">
            Verifique se o projeto pertence ao workspace ativo.
          </p>
        </div>
      </div>
    );
  if (!pages.length)
    return (
      <div className="grid min-h-[620px] place-items-center rounded-[28px] border border-[#e2e0e8] bg-white p-8 text-center shadow-sm">
        <div className="max-w-md">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0054fc]">
            <Monitor />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-.04em]">
            Crie a página deste negócio
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#706d78]">
            Monte uma página conectada às ações que seus clientes precisam realizar.
          </p>
          <Button className="mt-6" onClick={() => addPage("home")}>
            <Plus size={17} />
            Criar página inicial
          </Button>
        </div>
      </div>
    );

  return (
    <div className="-m-4 min-h-[calc(100vh-73px)] bg-[#f1f5f9] sm:-m-6 lg:-m-8">
      <div className="flex h-16 items-center gap-2 border-b border-[#dfe6ee] bg-white px-3 sm:gap-3 sm:px-4">
        <Brand className="mr-1 shrink-0" />
        <div className="hidden min-w-0 md:block">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-black">
              Minha página
            </h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${project.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-[#efeff3] text-[#686570]"}`}
            >
              {project.status === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>
          <p className="text-[11px] text-[#85818d]">
            {saveState === "saving"
              ? "Salvando…"
              : saveState === "dirty"
                ? "Alterações pendentes"
                : saveState === "error"
                  ? "Erro ao salvar"
                  : `${project.name} · Salvo`}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            data-testid="site-editor-mode-toggle"
            size="sm"
            variant="secondary"
            onClick={() => {
              setMode((current) => current === "simple" ? "advanced" : "simple");
              setMobilePanel(undefined);
            }}
          >
            {mode === "simple" ? "Modo avançado" : "Modo simples"}
          </Button>
          <Button
            className="hidden sm:inline-flex"
            size="icon"
            variant="ghost"
            aria-label="Desfazer"
            disabled={!undo.length}
            onClick={undoChange}
          >
            <Undo2 size={17} />
          </Button>
          <Button
            className="hidden sm:inline-flex"
            size="icon"
            variant="ghost"
            aria-label="Refazer"
            disabled={!redo.length}
            onClick={redoChange}
          >
            <Redo2 size={17} />
          </Button>
          <div className="mx-2 hidden h-7 w-px bg-[#e4e2e9] sm:block" />
          {(["desktop", "tablet", "mobile"] as Device[]).map((item) => {
            const Icon =
              item === "desktop"
                ? Desktop
                : item === "tablet"
                  ? Tablet
                  : Smartphone;
            return (
              <Button
                key={item}
                className={item === "mobile" ? "" : "hidden sm:inline-flex"}
                size="icon"
                variant={device === item ? "secondary" : "ghost"}
                aria-label={`Visualização ${item}`}
                onClick={() => setDevice(item)}
              >
                <Icon size={17} />
              </Button>
            );
          })}
          <Button
            className="ml-2 hidden lg:inline-flex"
            size="sm"
            variant="secondary"
            disabled={aiLoading}
            onClick={() => void requestAI(activeSection ? "section" : "page")}
          >
            {aiLoading ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            Pedir ajuda à Sobe IA
          </Button>
          <a
            href={`/${encodeURIComponent(project.slug)}/preview`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring hidden min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-extrabold text-[#536178] hover:bg-[#eef4fa] sm:inline-flex"
          >
            <Eye size={15} />
            Prévia
          </a>
          <Button
            size="sm"
            variant="secondary"
            disabled={saveState === "saving"}
            onClick={() => activePage && void persist(activePage)}
          >
            {saveState === "saving" ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : (
              <Save size={15} />
            )}
            Salvar
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            Publicar
          </Button>
        </div>
      </div>
      {message ? (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-800"
        >
          {message}
        </div>
      ) : null}
      {mode === "simple" && pages.length > 1 ? (
        <div className="flex items-end gap-3 border-b border-[#dfe6ee] bg-white px-4 py-3">
          <label className="min-w-0 flex-1 text-xs font-extrabold text-[#536178]">
            Página atual
            <select className="mt-1 min-h-11 w-full border border-[#d7e0e9] bg-white px-3 text-sm" value={activePage?.id || ""} onChange={(event) => { setSelectedPageId(event.target.value); setSelectedSectionId(undefined); }}>
              {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
            </select>
          </label>
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-extrabold text-[#0054fc]">Mais opções</summary>
            <div className="absolute right-0 top-12 z-40 w-56 border border-[#dfe6ee] bg-white p-2 shadow-xl">
              <button type="button" onClick={() => addPage("page")} className="min-h-11 w-full px-3 text-left text-sm font-bold hover:bg-[#f1f5f9]">Adicionar página</button>
              <button type="button" onClick={() => addPage("landing")} className="min-h-11 w-full px-3 text-left text-sm font-bold hover:bg-[#f1f5f9]">Página para campanha</button>
            </div>
          </details>
        </div>
      ) : null}
      {mode === "advanced" ? <div className="flex items-center gap-2 border-b border-[#dfe6ee] bg-white p-3 xl:hidden">
        <label className="min-w-0 flex-1 text-xs font-black text-[#5f6673]">
          Página ativa
          <select className="mt-1 min-h-11 w-full rounded-xl border border-[#d7e0e9] bg-white px-3 text-sm" value={activePage?.id || ""} onChange={(event) => { setSelectedPageId(event.target.value); setSelectedSectionId(undefined); }}>
            {pages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
          </select>
        </label>
        <Button className="mt-5" size="icon" variant="secondary" aria-label="Adicionar página" onClick={() => addPage("page")}><Plus /></Button>
      </div> : null}
      {mode === "advanced" && !mobilePanel ? <div className="grid grid-cols-3 gap-1 border-b border-[#d7e0e9] bg-white p-2 xl:hidden">
        <button type="button" onClick={() => setMobilePanel("pages")} className="min-h-11 rounded-xl text-xs font-black text-[#53606d] hover:bg-[#eef6ff]">Páginas</button>
        <button type="button" onClick={() => setMobilePanel("sections")} className="min-h-11 rounded-xl text-xs font-black text-[#53606d] hover:bg-[#eef6ff]">Conteúdo</button>
        <button type="button" onClick={() => setMobilePanel("properties")} className="min-h-11 rounded-xl bg-[#0054fc] text-xs font-black text-white">Propriedades</button>
      </div> : null}
      {mode === "advanced" && mobilePanel === "pages" ? <MobileDrawer title="Páginas" onClose={() => setMobilePanel(undefined)}><div className="space-y-1">{pages.map((page) => <button key={page.id} type="button" onClick={() => { setSelectedPageId(page.id); setSelectedSectionId(undefined); setMobilePanel(undefined); }} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-bold ${page.id === activePage?.id ? "bg-[#e8f4ff] text-[#0054fc]" : "hover:bg-[#f1f5f9]"}`}><span>{page.isHome ? "⌂" : page.type === "landing" ? "LP" : "P"}</span><span className="min-w-0 flex-1 truncate">{page.name}</span></button>)}</div><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => { addPage("page"); setMobilePanel(undefined); }}><Plus />Página</Button><Button variant="secondary" onClick={() => { addPage("landing"); setMobilePanel(undefined); }}><Plus />Landing</Button></div></MobileDrawer> : null}
      {mode === "advanced" && mobilePanel === "sections" ? <MobileDrawer title="Conteúdo desta página" onClose={() => setMobilePanel(undefined)}><div className="space-y-1">{activePage?.sections.toSorted((a, b) => a.order - b.order).map((section) => <button key={section.id} type="button" onClick={() => { setSelectedSectionId(section.id); setMobilePanel("properties"); }} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-bold ${section.id === activeSection?.id ? "bg-[#e8f4ff] text-[#0054fc]" : "hover:bg-[#f1f5f9]"}`}><GripVertical size={14} /><span className="min-w-0 flex-1 truncate">{section.title || presenceSectionRegistry[section.type].label}</span></button>)}</div><details className="mt-4"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-dashed border-[#b9cce1] px-3 text-xs font-black text-[#0054fc]"><Plus size={14} />Adicionar conteúdo</summary><SectionLibrary onAdd={(type) => { addSection(type); setMobilePanel("properties"); }} /></details></MobileDrawer> : null}
      <div data-testid={`site-editor-${mode}`} className={`grid min-h-[calc(100vh-137px)] grid-cols-1 ${mode === "advanced" ? "xl:grid-cols-[240px_minmax(380px,1fr)_320px]" : "lg:grid-cols-[minmax(480px,1fr)_340px]"}`}>
        <aside className={mode === "advanced" ? "hidden border-r border-[#dfe6ee] bg-white xl:block" : "hidden"}>
          <div className="relative flex items-center justify-between border-b border-[#e4e2e9] px-4 py-3">
            <strong className="text-xs uppercase tracking-[.12em] text-[#77727e]">
              Páginas
            </strong>
            <button
              type="button"
              onClick={() => setPageMenuOpen((open) => !open)}
              aria-label="Adicionar página"
              className="grid size-8 place-items-center rounded-lg hover:bg-[#ebeaf0]"
            >
              <Plus size={16} />
            </button>
            {pageMenuOpen ? (
              <div className="absolute right-3 top-12 z-20 w-48 rounded-xl border border-[#dedce6] bg-white p-2 shadow-xl">
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[#f2f1f5]"
                  onClick={() => addPage("page")}
                >
                  Página simples
                </button>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-[#f2f1f5]"
                  onClick={() => addPage("landing")}
                >
                  Landing page
                </button>
              </div>
            ) : null}
          </div>
          <div className="space-y-1 p-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                onClick={() => {
                  setSelectedPageId(page.id);
                  setSelectedSectionId(undefined);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold ${page.id === activePage?.id ? "bg-[#e8f4ff] text-[#0054fc]" : "text-[#5f6673] hover:bg-[#f1f5f9]"}`}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-white text-[10px] shadow-sm">
                  {page.isHome ? "⌂" : "P"}
                </span>
                <span className="min-w-0 flex-1 truncate">{page.name}</span>
                {page.type === "landing" ? (
                  <span className="text-[9px] uppercase">LP</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mx-3 mt-4 border-t border-[#e3e9ef] pt-4">
            <div className="flex items-center justify-between px-1">
              <strong className="text-xs uppercase tracking-[.12em] text-[#697180]">Conteúdo desta página</strong>
              <span className="text-[10px] font-bold text-[#8b94a1]">{activePage?.sections.length || 0}</span>
            </div>
            <div className="mt-2 space-y-1" data-testid="site-section-list">
              {activePage?.sections.toSorted((a, b) => a.order - b.order).map((section) => (
                <div key={section.id} draggable onDragStart={() => { draggedSectionId.current = section.id; }} onDragOver={(event) => event.preventDefault()} onDrop={() => dropSection(section.id)}>
                  <button type="button" onClick={() => setSelectedSectionId(section.id)} onKeyDown={(event) => { if (event.altKey && event.key === "ArrowUp") moveSection(section.id, -1); if (event.altKey && event.key === "ArrowDown") moveSection(section.id, 1); }} className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${section.id === activeSection?.id ? "bg-[#e8f4ff] text-[#0054fc]" : "text-[#505866] hover:bg-[#f1f5f9]"}`}>
                    <GripVertical size={14} className="cursor-grab text-[#a6afbb]" />
                    <span className="min-w-0 flex-1 truncate">{section.title || presenceSectionRegistry[section.type].label}</span>
                    {!section.isActive ? <Eye size={13} className="opacity-40" /> : null}
                  </button>
                </div>
              ))}
            </div>
            <details className="mt-3">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-dashed border-[#b9cce1] px-3 text-xs font-black text-[#0054fc]"><Plus size={14} />Adicionar conteúdo</summary>
              <SectionLibrary onAdd={addSection} />
            </details>
          </div>
          <div className="mx-3 mt-3 border-t border-[#e3e1e8] pt-3">
            <button
              type="button"
              onClick={duplicatePage}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-bold text-[#65616d] hover:bg-[#efeff3]"
            >
              <Copy size={14} />
              Duplicar página
            </button>
            <button
              type="button"
              disabled={
                activePage?.isHome ||
                project.entryPoints?.some(
                  (entry) => entry.presencePageId === activePage?.id,
                )
              }
              onClick={() => void removePage()}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-xs font-bold text-[#a53d3d] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} />
              Excluir página
            </button>
          </div>
        </aside>
        <section className="min-w-0 bg-[#e9eff5] p-4 md:p-7">
          <div
            className="mx-auto overflow-auto rounded-[22px] border border-[#cfdae5] bg-[#dde6ee] p-3 shadow-inner"
            style={{ maxWidth: viewport[device] + 26 }}
          >
            <div
              className="overflow-hidden rounded-[14px] bg-white shadow-[0_20px_60px_rgba(28,25,40,.18)]"
              style={{ width: viewport[device], maxWidth: "100%" }}
            >
              {previewProject && activePage ? (
                <PublicPresencePage
                  project={previewProject}
                  page={activePage}
                  preview
                  editorHooks={mode === "simple" ? {
                    selectedSectionId,
                    onSelectSection: (sectionId) => setSelectedSectionId(sectionId),
                  } : undefined}
                />
              ) : null}
            </div>
          </div>
        </section>
        {mode === "simple" && activeSection ? <button type="button" data-testid="simple-editor-backdrop" aria-label="Fechar edição" onClick={() => setSelectedSectionId(undefined)} className="fixed inset-0 z-[35] bg-[#101827]/45 lg:hidden" /> : null}
        {mode === "simple" ? (
          <aside
            role={activeSection ? "dialog" : undefined}
            aria-modal={activeSection ? true : undefined}
            aria-label={activeSection ? "Editar esta parte" : undefined}
            className={`${activeSection ? "fixed inset-x-0 bottom-0 z-40 max-h-[84vh] overflow-y-auto bg-white p-5 shadow-[0_-20px_70px_rgba(15,23,42,.28)]" : "hidden"} border-l border-[#dfe6ee] lg:static lg:block lg:max-h-[calc(100vh-137px)] lg:overflow-y-auto lg:bg-white lg:p-5 lg:shadow-none`}
          >
            {activeSection && activePage ? (
              <>
                <div className="mb-3 flex justify-end lg:hidden">
                  <Button size="icon" variant="ghost" aria-label="Fechar edição" onClick={() => setSelectedSectionId(undefined)}><X size={17} /></Button>
                </div>
                <SimpleSectionInspector
                  project={previewProject!}
                  page={activePage}
                  section={activeSection}
                  onChange={updateSection}
                  onImprove={() => void requestAI("section")}
                  onMove={(direction) => moveSection(activeSection.id, direction)}
                  onAdvanced={() => setMode("advanced")}
                />
              </>
            ) : (
              <div className="flex min-h-64 flex-col justify-center">
                <strong className="text-xl font-black tracking-[-.025em]">Clique em uma parte da página</strong>
                <p className="mt-3 text-sm leading-6 text-[#65717d]">Você poderá editar título, texto, imagem e botões sem lidar com configurações técnicas.</p>
                <Button className="mt-5 self-start" variant="secondary" onClick={() => void requestAI("page")}><Sparkles size={16} /> Melhorar esta página</Button>
              </div>
            )}
          </aside>
        ) : null}
        {mode === "advanced" && mobilePanel === "properties" ? <button type="button" aria-label="Fechar painel" onClick={() => setMobilePanel(undefined)} className="fixed inset-0 z-[35] bg-[#101827]/45 xl:hidden" /> : null}
        <aside role={mobilePanel === "properties" ? "dialog" : undefined} aria-modal={mobilePanel === "properties" ? true : undefined} aria-label={mobilePanel === "properties" ? "Propriedades" : undefined} className={mode === "advanced" ? `border-l border-[#dfe6ee] bg-white ${mobilePanel === "properties" ? "fixed inset-x-0 bottom-0 z-40 max-h-[82vh] overflow-hidden rounded-t-[28px] shadow-[0_-20px_70px_rgba(15,23,42,.28)]" : "hidden"} xl:static xl:block xl:max-h-none xl:rounded-none xl:shadow-none` : "hidden"}>
          <div className="border-b border-[#e6e4eb] px-4 py-3">
            <div className="flex items-center justify-between">
              <strong className="text-xs uppercase tracking-[.12em] text-[#77727e]">
                {activeSection
                  ? presenceSectionRegistry[activeSection.type].label
                  : "Página"}
              </strong>
              <Button className="ml-auto xl:hidden" size="icon" variant="ghost" aria-label="Fechar propriedades" onClick={() => setMobilePanel(undefined)}><X size={16} /></Button>
              {activeSection ? (
                <div className="flex">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Mover seção para cima"
                    onClick={() => moveSection(activeSection.id, -1)}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Mover seção para baixo"
                    onClick={() => moveSection(activeSection.id, 1)}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Duplicar seção"
                    onClick={duplicateSection}
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir seção"
                    onClick={removeSection}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
          <Tabs defaultValue="content" className="max-h-[calc(100vh-185px)] overflow-y-auto">
            <TabsList className="sticky top-0 z-10 grid h-auto w-full grid-cols-4 rounded-none border-b border-[#e3e9ef] bg-white p-2">
              <TabsTrigger value="content" className="px-1 text-[11px]">Conteúdo</TabsTrigger>
              <TabsTrigger value="visual" className="px-1 text-[11px]">Aparência</TabsTrigger>
              <TabsTrigger value="conversion" className="px-1 text-[11px]">Ação</TabsTrigger>
              <TabsTrigger value="advanced" className="px-1 text-[11px]">Avançado</TabsTrigger>
            </TabsList>
            <TabsContent value="content" className="m-0 p-4">
            {activeSection && activePage ? (
              <SectionInspector
                project={previewProject!}
                page={activePage}
                section={activeSection}
                onChange={updateSection}
              />
            ) : activePage ? (
              <PageInspector
                project={previewProject!}
                page={activePage}
                onChange={updatePage}
              />
            ) : null}
            <div className="mt-6 border-t border-[#e6e4eb] pt-4">
              <strong className="text-xs uppercase tracking-[.12em] text-[#77727e]">
                Conteúdo
              </strong>
              <div className="mt-2 space-y-1">
                {activePage?.sections
                  .toSorted((a, b) => a.order - b.order)
                  .map((section) => (
                    <div
                      key={section.id}
                      draggable
                      onDragStart={() => {
                        draggedSectionId.current = section.id;
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropSection(section.id)}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${section.id === activeSection?.id ? "bg-[#eaf3ff] text-[#0054fc]" : "hover:bg-[#f2f1f5]"}`}
                      >
                        <GripVertical
                          size={14}
                          className="cursor-grab text-[#aaa6b0]"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {section.title ||
                            presenceSectionRegistry[section.type].label}
                        </span>
                        {!section.isActive ? (
                          <Eye size={13} className="opacity-40" />
                        ) : null}
                      </button>
                    </div>
                  ))}
              </div>
              <details className="mt-3">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-dashed border-[#cbc8d4] px-3 text-xs font-black text-[#0054fc]">
                  <Plus size={14} />
                  Adicionar conteúdo
                </summary>
                <SectionLibrary onAdd={addSection} />
              </details>
            </div>
            </TabsContent>
            <TabsContent value="visual" className="m-0 p-4">
              <div className="rounded-2xl border border-[#dfe7ef] bg-[#f8fbfe] p-4"><strong className="text-sm">Visual controlado</strong><p className="mt-2 text-xs leading-5 text-[#66717e]">Escolha composição, largura, ritmo, fundo e tratamento de mídia. CSS arbitrário não é aceito.</p></div>
              {activeSection && activePage ? <div className="mt-4"><SectionInspector project={previewProject!} page={activePage} section={activeSection} onChange={updateSection} appearanceOnly /></div> : activePage ? <div className="mt-4"><PageInspector project={previewProject!} page={activePage} onChange={updatePage} /></div> : null}
            </TabsContent>
            <TabsContent value="conversion" className="m-0 p-4">
              <div className="rounded-2xl border border-[#dbe8f5] bg-[#eff7ff] p-4"><strong className="text-sm">Objetivo da página</strong><p className="mt-2 text-xs leading-5 text-[#5d6c7b]">{activePage?.defaultConversionGoalId ? "Esta página está conectada a um objetivo mensurável." : "Conecte esta página a um objetivo antes de publicar."}</p></div>
              {activePage ? <label className="mt-4 block text-xs font-bold text-[#555f6b]">Objetivo principal<select value={activePage.defaultConversionGoalId || ""} onChange={(event) => updatePage({ ...activePage, defaultConversionGoalId: event.target.value || undefined })} className="mt-2 min-h-11 w-full rounded-xl border border-[#d9e1e9] bg-white px-3 text-sm"><option value="">Selecionar objetivo</option>{project.conversionGoals?.filter((goal) => goal.isActive).map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label> : null}
            </TabsContent>
            <TabsContent value="advanced" className="m-0 p-4">
              <div className="rounded-2xl border border-[#dfe7ef] p-4"><strong className="text-sm">Fontes conectadas</strong><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[#75808c]">Produtos</dt><dd className="mt-1 font-black">{project.commercialConfig?.catalogItems?.length || 0}</dd></div><div><dt className="text-[#75808c]">Serviços</dt><dd className="mt-1 font-black">{project.commercialConfig?.serviceOfferings?.length || 0}</dd></div><div><dt className="text-[#75808c]">Unidades</dt><dd className="mt-1 font-black">{project.commercialConfig?.locations?.length || 0}</dd></div><div><dt className="text-[#75808c]">Objetivos</dt><dd className="mt-1 font-black">{project.conversionGoals?.length || 0}</dd></div></dl></div>
              <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#edf8ff,#e7f1ff)] p-4"><span className="flex items-center gap-2 text-xs font-black text-[#0f64c8]"><Sparkles />Sobe IA</span><h3 className="mt-3 font-black">O que você quer fazer?</h3><p className="mt-2 text-xs leading-5 text-[#526476]">Explique o foco, a oferta, o público ou a página. Planner e IA usam os dados reais do negócio; nada é publicado automaticamente.</p><textarea aria-label="Instrução para a Sobe IA" value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder="Ex.: Quero uma landing para revendedores e menos destaque para o FAQ." className="mt-4 min-h-28 w-full resize-y rounded-xl border border-[#b9d2eb] bg-white p-3 text-sm leading-6 outline-none focus:border-[#0054fc] focus:ring-4 focus:ring-[#0054fc]/10" /><div className="mt-3 flex flex-wrap gap-2">{copilotActions.map((action) => <button key={action.intent} type="button" onClick={() => setAiIntent(action.intent)} className={`min-h-9 rounded-full border px-3 text-[11px] font-black ${aiIntent === action.intent ? "border-[#0054fc] bg-[#0054fc] text-white" : "border-[#b9d2eb] bg-white text-[#36536f]"}`}>{action.label}</button>)}</div><Button className="mt-4 w-full bg-[#0054fc] hover:bg-[#0d54a9]" size="sm" disabled={aiLoading} onClick={() => void requestStructure(aiIntent)}>{aiLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}Gerar proposta</Button></div>
            </TabsContent>
            <TabsContent value="advanced" className="m-0 border-t border-[#e3e9ef] p-4">
              <div className="rounded-2xl bg-[#f7fbff] p-4"><strong className="text-sm">Quality Assistant</strong><p className="mt-2 text-xs leading-5 text-[#666174]">Diagnóstico da página ativa. Ele orienta; não altera nem publica nada sozinho.</p></div>
              <div className="mt-4 flex flex-col gap-2">{qualityWarnings.length ? qualityWarnings.map((warning) => <div key={warning.code} className="rounded-xl border border-[#eaf3ff] bg-white p-3"><strong className="text-xs">{warning.message}</strong><p className="mt-1 text-[11px] text-[#746f7d]">Selecione a seção relacionada ou peça uma proposta à Sobe IA.</p></div>) : <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">Nenhum problema estrutural detectado nesta página.</div>}</div>
            </TabsContent>
            <TabsContent value="advanced" className="m-0 border-t border-[#e3e9ef] p-4">
              <div className="rounded-2xl bg-[#eef6ff] p-4"><strong className="text-sm">Performance Copilot</strong><p className="mt-2 text-xs leading-5 text-[#566a7e]">Sugestões só aparecem após 30 dias, 30 sessões e 15 sessões da meta principal quando aplicável.</p></div>
              {!performance?.publishedAt ? <p className="mt-4 rounded-xl border border-[#dfe7ef] p-4 text-xs leading-5 text-[#697684]">Publique o site para iniciar a janela de aprendizado.</p> : performance.evidence ? <div className="mt-4 flex flex-col gap-3"><p className={`rounded-xl p-3 text-xs font-bold ${performance.evidence.eligible ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{performance.evidence.message}</p><EvidenceBar label="Dias" progress={performance.evidence.daysProgress} value={`${performance.evidence.completeDays}/30`} /><EvidenceBar label="Sessões" progress={performance.evidence.sessionsProgress} value={`${Math.round(performance.evidence.sessionsProgress * 30)}/30`} />{performance.evidence.goalSessionsProgress != null ? <EvidenceBar label={performance.primaryGoalName || "Meta principal"} progress={performance.evidence.goalSessionsProgress} value={`${Math.round(performance.evidence.goalSessionsProgress * 15)}/15`} /> : null}{performance.suggestions.map((suggestion) => { const explanation = performanceExplanations[suggestion.id]; const proposalInstruction = `Proponha uma alteração para “${suggestion.title}”. Evidência observada: ${suggestion.explanation}.${explanation ? ` Leitura: ${explanation.explanation} Próxima ação: ${explanation.recommendedAction}` : ""}`; return <article key={suggestion.id} className="rounded-xl border border-[#dfe7ef] p-3"><strong className="text-xs">{suggestion.title}</strong><p className="mt-2 text-[11px] leading-5 text-[#697684]">{suggestion.explanation}</p>{explanation ? <div className="mt-3 rounded-xl bg-[#f7fbff] p-3"><span className="text-[10px] font-black uppercase tracking-[.08em] text-[#0054fc]">{explanation.usedAI ? "Leitura da Sobe IA" : "Leitura determinística"}</span><p className="mt-2 text-[11px] leading-5 text-[#5f5970]">{explanation.explanation}</p><p className="mt-2 text-[11px] font-bold text-[#4e4861]">Próxima ação: {explanation.recommendedAction}</p></div> : null}<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={performanceLoadingId === suggestion.id} onClick={() => void explainPerformanceSuggestion(suggestion.id)}>{performanceLoadingId === suggestion.id ? <LoaderCircle className="animate-spin" /> : <Sparkles />}{explanation ? "Atualizar explicação" : "Explicar com IA"}</Button><Button size="sm" variant="secondary" disabled={aiLoading} onClick={() => { setAiInstruction(proposalInstruction); setAiIntent("reorganize"); void requestStructure("reorganize", proposalInstruction); }}>Criar proposta</Button></div></article>; })}</div> : <p className="mt-4 text-xs text-[#697684]">Carregando evidência…</p>}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      {aiError ? (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-red-200 bg-white p-4 text-sm font-bold text-red-800 shadow-2xl"
        >
          {aiError}
          <button
            className="ml-3"
            onClick={() => setAiError("")}
            aria-label="Fechar erro"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {structureProposal ? (
        <div role="dialog" aria-modal="true" aria-labelledby="structure-proposal-title" className="fixed inset-0 z-50 grid place-items-center bg-[#101827]/55 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,.34)] md:p-7">
            <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 text-xs font-black text-[#0054fc]"><Sparkles />Sobe IA · {structureProposal.usedAI ? "planner + IA contextual" : "planner determinístico"}</span><h2 id="structure-proposal-title" className="mt-2 text-2xl font-black">Revise a proposta</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#66717e]">{structureProposal.suggestion.reasoning}</p></div><Button size="icon" variant="ghost" aria-label="Fechar proposta" onClick={() => setStructureProposal(undefined)}><X /></Button></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">{structureProposal.suggestion.pages.map((page) => <article key={`${page.type}-${page.pathSuggestion}`} className="rounded-2xl border border-[#dfe7ef] p-4"><div className="flex items-center justify-between gap-3"><strong>{page.name}</strong><span className="text-xs font-bold text-[#0054fc]">{page.pathSuggestion}</span></div><p className="mt-2 text-xs leading-5 text-[#687582]">{page.purpose}</p><ol className="mt-3 flex flex-col gap-1 text-xs">{page.sections.map((section, index) => <li key={`${section.sectionType}-${index}`} className="flex gap-2"><span className="text-[#0054fc]">{index + 1}.</span><span>{presenceSectionRegistry[section.sectionType].label} — {section.purpose}</span></li>)}</ol></article>)}</div>
            {structureProposal.suggestion.warnings.length ? <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{structureProposal.suggestion.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
            <div className="mt-5 rounded-2xl border border-[#dfe7ef] bg-[#f8fafc] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">Diff semântico</strong><button type="button" className="text-xs font-black text-[#0054fc]" onClick={() => setSelectedOperationIds(new Set(selectedOperationIds.size === structureProposal.operations.length ? [] : structureProposal.operations.map((operation) => operation.id)))}>{selectedOperationIds.size === structureProposal.operations.length ? "Desmarcar tudo" : "Selecionar tudo"}</button></div><div className={`mt-3 flex flex-col gap-2 ${customizingProposal ? "" : "max-h-52 overflow-hidden"}`}>{structureProposal.operations.map((operation) => <label key={operation.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-[#dde6ee] bg-white px-3 py-2 text-xs font-bold"><input type="checkbox" checked={selectedOperationIds.has(operation.id)} onChange={(event) => setSelectedOperationIds((current) => { const next = new Set(current); if (event.target.checked) next.add(operation.id); else next.delete(operation.id); return next; })} /><span className={`grid size-6 shrink-0 place-items-center rounded-lg ${operation.type === "remove_section" ? "bg-red-50 text-red-700" : operation.type === "move_section" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-[#0054fc]"}`}>{operationSymbol(operation)}</span><span>{operationDescription(operation)}</span></label>)}</div>{structureProposal.operations.length > 4 ? <button type="button" onClick={() => setCustomizingProposal((value) => !value)} className="mt-3 text-xs font-black text-[#0054fc]">{customizingProposal ? "Mostrar menos" : "Ver e personalizar todas as operações"}</button> : null}</div>
            <p className="mt-4 text-xs font-bold text-[#65717d]">{selectedOperationIds.size} de {structureProposal.operations.length} operações selecionadas. A aplicação altera apenas o rascunho e nunca publica o site.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="ghost" onClick={() => setStructureProposal(undefined)}>Descartar</Button><Button variant="secondary" onClick={() => setCustomizingProposal(true)}>Personalizar antes</Button><Button disabled={aiLoading || !selectedOperationIds.size} onClick={() => void applyStructureProposal()}>{aiLoading ? <LoaderCircle className="animate-spin" /> : null}Aplicar ao rascunho</Button></div>
          </div>
        </div>
      ) : null}
      {aiProposal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Proposta da IA"
          className="fixed inset-0 z-50 grid place-items-center bg-[#17141f]/55 p-4"
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#0054fc]">
                  <Sparkles size={14} />
                  Proposta da IA
                </span>
                <h2 className="mt-2 text-2xl font-black">
                  Revise antes de aplicar
                </h2>
                <p className="mt-1 text-sm text-[#74707c]">
                  Nada foi aplicado ou publicado automaticamente.
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Fechar proposta"
                onClick={() => setAiProposal(undefined)}
              >
                <X />
              </Button>
            </div>
            <div className="mt-5 rounded-2xl bg-[#f7fbff] p-4">
              <strong>{aiProposal.draft.page.name}</strong>
              <ol className="mt-3 space-y-2">
                {aiProposal.draft.sections.map((section, index) => (
                  <li
                    key={`${section.key}-${index}`}
                    className="flex gap-3 text-sm"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#0054fc]">
                      {index + 1}
                    </span>
                    <span>
                      <b>
                        {section.title ||
                          presenceSectionRegistry[section.type].label}
                      </b>
                      <small className="block text-[#77727e]">
                        {section.type}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            {aiProposal.draft.rationale.length ? (
              <div className="mt-4">
                <strong className="text-sm">Por que esta proposta</strong>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#6f6b77]">
                  {aiProposal.draft.rationale.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setAiProposal(undefined)}
              >
                Descartar
              </Button>
              <Button onClick={applyAIProposal}>Aplicar ao rascunho</Button>
            </div>
          </div>
        </div>
      ) : null}
      <PublishReadinessModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        project={{ ...project, presence: { pages } }}
        onPublished={(published) => {
          setProject(published);
          setPages(published.presence?.pages || pages);
        }}
      />
    </div>
  );
}

function EvidenceBar({ label, progress, value }: { label: string; progress: number; value: string }) {
  return <div><div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-bold text-[#5f6d7b]"><span>{label}</span><span>{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#dfe8f1]"><div className="h-full rounded-full bg-[#0054fc]" style={{ width: `${Math.round(progress * 100)}%` }} /></div></div>;
}

function PageInspectorBase({
  project,
  page,
  onChange,
}: {
  project: Project;
  page: PresencePage;
  onChange(page: PresencePage): void;
}) {
  const input =
    "mt-1 min-h-10 w-full rounded-xl border border-[#dedce7] bg-white px-3 text-sm outline-none focus:border-[#0186fc] focus:ring-4 focus:ring-[#0186fc]/10";
  const label = "block text-xs font-extrabold text-[#55515e]";
  const issues = getPresenceReadinessIssues(project);
  const readiness = Math.max(
    0,
    100 -
      issues.filter((issue) => issue.severity === "blocking").length * 25 -
      issues.filter((issue) => issue.severity !== "blocking").length * 10,
  );
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#f7fbff] p-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#0054fc]">
              Prontidão
            </span>
            <strong className="mt-1 block text-sm">
              {issues.some((issue) => issue.severity === "blocking")
                ? "Revise antes de publicar"
                : "Pronto para publicar"}
            </strong>
          </div>
          <b className="text-2xl">{readiness}%</b>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-[#0054fc]"
            style={{ width: `${readiness}%` }}
          />
        </div>
        {issues.slice(0, 4).map((issue) => (
          <p key={issue.id} className="mt-2 text-xs text-[#6f6b77]">
            {issue.severity === "blocking" ? "!" : "•"} {issue.label}
          </p>
        ))}
        {!issues.length ? (
          <p className="mt-2 text-xs text-[#39705c]">
            ✓ Estrutura e CTAs válidos
          </p>
        ) : null}
      </div>
      <label className={label}>
        Nome
        <input
          className={input}
          value={page.name}
          onChange={(event) => onChange({ ...page, name: event.target.value })}
        />
      </label>
      <label className={label}>
        Propósito da página
        <textarea className={`${input} min-h-20 py-2`} value={page.purpose || ""} maxLength={400} onChange={(event) => onChange({ ...page, purpose: event.target.value || undefined })} placeholder="Explique qual decisão esta página deve apoiar." />
      </label>
      <label className={label}>
        Caminho
        <input
          className={input}
          disabled={page.isHome}
          value={page.path}
          onChange={(event) =>
            onChange({
              ...page,
              path: event.target.value.startsWith("/")
                ? event.target.value
                : `/${event.target.value}`,
            })
          }
        />
      </label>
      <label className={label}>
        Título SEO
        <input
          className={input}
          value={page.seoTitle || ""}
          maxLength={70}
          onChange={(event) =>
            onChange({ ...page, seoTitle: event.target.value || undefined })
          }
        />
        <span className="mt-1 block text-right text-[10px] text-[#8a8691]">
          {page.seoTitle?.length || 0}/70
        </span>
      </label>
      <label className={label}>
        Descrição SEO
        <textarea
          className={`${input} min-h-24 py-2`}
          value={page.seoDescription || ""}
          maxLength={170}
          onChange={(event) =>
            onChange({
              ...page,
              seoDescription: event.target.value || undefined,
            })
          }
        />
      </label>
      <label className="flex items-center justify-between gap-4 text-xs font-extrabold">
        Indexar em buscadores
        <input
          type="checkbox"
          checked={page.isIndexable}
          onChange={(event) =>
            onChange({ ...page, isIndexable: event.target.checked })
          }
        />
      </label>
      <label className="flex items-center justify-between gap-4 text-xs font-extrabold">
        Página ativa
        <input
          type="checkbox"
          checked={page.isActive}
          onChange={(event) =>
            onChange({ ...page, isActive: event.target.checked })
          }
        />
      </label>
      <label className={label}>
        Apresentação da conversão
        <select
          className={input}
          value={page.settings.conversionPresentation.mode}
          onChange={(event) =>
            onChange({
              ...page,
              settings: {
                ...page.settings,
                conversionPresentation: {
                  mode: event.target.value as "overlay" | "replace",
                },
              },
            })
          }
        >
          <option value="overlay">Overlay</option>
          <option value="replace">Substituir página</option>
        </select>
      </label>
    </div>
  );
}

function PageInspector(props: {
  project: Project;
  page: PresencePage;
  onChange(page: PresencePage): void;
}) {
  const { page, onChange } = props;
  const input =
    "mt-1 min-h-10 w-full rounded-xl border border-[#dedce7] bg-white px-3 text-sm outline-none focus:border-[#0186fc] focus:ring-4 focus:ring-[#0186fc]/10";
  const label = "block text-xs font-extrabold text-[#55515e]";
  const toggle =
    "flex min-h-10 items-center justify-between gap-4 text-xs font-extrabold";
  return (
    <div className="flex flex-col gap-5">
      <PageInspectorBase {...props} />
      <div className="h-px bg-[#e8e6ed]" />
      <fieldset>
        <legend className="mb-3 text-xs font-black uppercase tracking-[.12em] text-[#77727e]">
          Layout da página
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Largura
            <select
              className={input}
              value={page.settings.layout.maxWidth || "xl"}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    layout: {
                      ...page.settings.layout,
                      maxWidth: event.target.value as NonNullable<
                        PresencePage["settings"]["layout"]["maxWidth"]
                      >,
                    },
                  },
                })
              }
            >
              <option value="md">Estreita</option>
              <option value="lg">Média</option>
              <option value="xl">Ampla</option>
              <option value="full">Tela inteira</option>
            </select>
          </label>
          <label className={label}>
            Ritmo vertical
            <select
              className={input}
              value={page.settings.layout.sectionSpacing || "normal"}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    layout: {
                      ...page.settings.layout,
                      sectionSpacing: event.target.value as NonNullable<
                        PresencePage["settings"]["layout"]["sectionSpacing"]
                      >,
                    },
                  },
                })
              }
            >
              <option value="compact">Compacto</option>
              <option value="normal">Normal</option>
              <option value="airy">Amplo</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-xs font-black uppercase tracking-[.12em] text-[#77727e]">
          Cabeçalho
        </legend>
        <div className="grid gap-1">
          <label className={toggle}>
            Exibir cabeçalho
            <input
              type="checkbox"
              checked={page.settings.header.enabled}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    header: {
                      ...page.settings.header,
                      enabled: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Usar logo
            <input
              type="checkbox"
              checked={page.settings.header.showLogo}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    header: {
                      ...page.settings.header,
                      showLogo: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Exibir navegação
            <input
              type="checkbox"
              checked={page.settings.header.showNavigation}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    header: {
                      ...page.settings.header,
                      showNavigation: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Fixar no topo
            <input
              type="checkbox"
              checked={page.settings.header.sticky}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    header: {
                      ...page.settings.header,
                      sticky: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-xs font-black uppercase tracking-[.12em] text-[#77727e]">
          Rodapé
        </legend>
        <div className="grid gap-1">
          <label className={toggle}>
            Exibir rodapé
            <input
              type="checkbox"
              checked={page.settings.footer.enabled}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    footer: {
                      ...page.settings.footer,
                      enabled: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Usar logo
            <input
              type="checkbox"
              checked={page.settings.footer.showLogo}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    footer: {
                      ...page.settings.footer,
                      showLogo: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Exibir redes sociais
            <input
              type="checkbox"
              checked={page.settings.footer.showSocialLinks}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    footer: {
                      ...page.settings.footer,
                      showSocialLinks: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <label className={toggle}>
            Exibir políticas
            <input
              type="checkbox"
              checked={page.settings.footer.showPolicies}
              onChange={(event) =>
                onChange({
                  ...page,
                  settings: {
                    ...page.settings,
                    footer: {
                      ...page.settings.footer,
                      showPolicies: event.target.checked,
                    },
                  },
                })
              }
            />
          </label>
        </div>
      </fieldset>
    </div>
  );
}
