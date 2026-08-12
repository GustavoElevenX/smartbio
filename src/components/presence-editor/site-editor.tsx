"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { features } from "@/lib/constants";
import type { AIPresenceDraft } from "@/features/presence/ai-presence.schema";
import type {
  PresencePage,
  PresenceSection,
  PresenceSectionType,
} from "@/features/presence/presence.types";
import type { Project } from "@/types";
import { SectionInspector } from "./section-editor-registry";

type SaveState = "saved" | "dirty" | "saving" | "error";
type Device = "desktop" | "tablet" | "mobile";
const viewport = { desktop: 1120, tablet: 768, mobile: 390 };
type AIProposal = {
  kind: "page" | "section";
  draft: AIPresenceDraft;
  targetSectionId?: string;
};

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
  const [project, setProject] = useState<Project | null>();
  const [pages, setPages] = useState<PresencePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>();
  const [device, setDevice] = useState<Device>("desktop");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [message, setMessage] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIProposal>();
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
  const activePage = pages.find((page) => page.id === selectedPageId);
  const activeSection = activePage?.sections.find(
    (section) => section.id === selectedSectionId,
  );
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
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ebe8ff] text-[#5e50d1]">
            <Monitor />
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-[-.04em]">
            Crie a presença digital deste negócio
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#706d78]">
            Monte uma página comercial pública conectada às metas e jornadas que
            já existem.
          </p>
          <Button className="mt-6" onClick={() => addPage("home")}>
            <Plus size={17} />
            Criar página inicial
          </Button>
        </div>
      </div>
    );

  return (
    <div className="-m-4 min-h-[calc(100vh-73px)] bg-[#efeff3] sm:-m-6 lg:-m-8">
      <div className="flex h-16 items-center gap-3 border-b border-[#dedde5] bg-white px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-black">
              Site · {project.name}
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
                  : "Salvo"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Desfazer"
            disabled={!undo.length}
            onClick={undoChange}
          >
            <Undo2 size={17} />
          </Button>
          <Button
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
                size="icon"
                variant={device === item ? "secondary" : "ghost"}
                aria-label={`Visualização ${item}`}
                onClick={() => setDevice(item)}
              >
                <Icon size={17} />
              </Button>
            );
          })}
          {features.presenceAI ? (
            <Button
              className="ml-2"
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
              {activeSection ? "Melhorar seção" : "Compor com IA"}
            </Button>
          ) : null}
          <Button
            className={features.presenceAI ? "" : "ml-2"}
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
      <div className="grid min-h-[calc(100vh-137px)] grid-cols-1 xl:grid-cols-[240px_minmax(520px,1fr)_320px]">
        <aside className="hidden border-r border-[#dedde5] bg-[#f8f8fa] xl:block">
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold ${page.id === activePage?.id ? "bg-[#e9e6ff] text-[#5547c8]" : "text-[#5f5b67] hover:bg-[#efeff3]"}`}
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
        <section className="min-w-0 bg-[#e8e8ed] p-4 md:p-7">
          <div
            className="mx-auto overflow-auto rounded-[22px] border border-[#d7d5de] bg-[#dad9df] p-3 shadow-inner"
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
                />
              ) : null}
            </div>
          </div>
        </section>
        <aside className="border-l border-[#dedde5] bg-white">
          <div className="border-b border-[#e6e4eb] px-4 py-3">
            <div className="flex items-center justify-between">
              <strong className="text-xs uppercase tracking-[.12em] text-[#77727e]">
                {activeSection
                  ? presenceSectionRegistry[activeSection.type].label
                  : "Página"}
              </strong>
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
          <div className="max-h-[calc(100vh-185px)] overflow-y-auto p-4">
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
                Seções
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
                        className={`flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-xs font-bold ${section.id === activeSection?.id ? "bg-[#ebe8ff] text-[#5547c8]" : "hover:bg-[#f2f1f5]"}`}
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
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-dashed border-[#cbc8d4] px-3 text-xs font-black text-[#5c50c7]">
                  <Plus size={14} />
                  Adicionar seção
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {Object.entries(presenceSectionRegistry).map(
                    ([type, definition]) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => addSection(type as PresenceSectionType)}
                        className="rounded-lg p-2 text-left text-[11px] font-bold hover:bg-[#f1f0f5]"
                      >
                        {definition.label}
                      </button>
                    ),
                  )}
                </div>
              </details>
            </div>
          </div>
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
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-[#6556d5]">
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
            <div className="mt-5 rounded-2xl bg-[#f5f3ff] p-4">
              <strong>{aiProposal.draft.page.name}</strong>
              <ol className="mt-3 space-y-2">
                {aiProposal.draft.sections.map((section, index) => (
                  <li
                    key={`${section.key}-${index}`}
                    className="flex gap-3 text-sm"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-black text-[#6556d5]">
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
    "mt-1 min-h-10 w-full rounded-xl border border-[#dedce7] bg-white px-3 text-sm outline-none focus:border-[#786be2] focus:ring-4 focus:ring-[#786be2]/10";
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
      <div className="rounded-2xl bg-[#f5f3ff] p-4">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#6a5bd6]">
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
            className="h-full rounded-full bg-[#6a5bd6]"
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
    "mt-1 min-h-10 w-full rounded-xl border border-[#dedce7] bg-white px-3 text-sm outline-none focus:border-[#786be2] focus:ring-4 focus:ring-[#786be2]/10";
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
