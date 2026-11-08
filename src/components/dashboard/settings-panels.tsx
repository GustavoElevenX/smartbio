"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  Globe2,
  LoaderCircle,
  RotateCcw,
  Save,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { WhatsAppNumbersEditor } from "@/components/dashboard/whatsapp-numbers-editor";
import { projectWhatsAppNumbers, whatsappNumberErrors } from "@/features/whatsapp/project-whatsapp-numbers";
import { projectRepository } from "@/lib/repositories/project-repository";
import { slugify } from "@/lib/utils";
import type { Project } from "@/types";
import { SimpleSettings } from "@/components/dashboard/simple-settings";
import { validateSimpleProject } from "@/features/simple-settings/edits";

export function SettingsNav({
  active,
}: {
  active: "profile" | "workspace" | "billing";
}) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {[
        ["profile", "Perfil", User],
        ["workspace", "Espaço de trabalho", Users],
        ["billing", "Plano e cobrança", CreditCard],
      ].map(([value, label, Icon]) => {
        const ItemIcon = Icon as typeof User;
        return (
          <Link
            key={String(value)}
            href={`/app/settings/${String(value)}`}
            className={`focus-ring inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold ${active === value ? "bg-[#0054fc] text-white" : "border border-[#dfdee6] bg-white text-[#686873]"}`}
          >
            <ItemIcon size={16} />
            {String(label)}
          </Link>
        );
      })}
    </div>
  );
}

export function ProjectSettings({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [dirty, setDirty] = useState(false);
  const [contextDirty, setContextDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    void projectRepository
      .getProject(projectId)
      .then((found) => setProject(found || null))
      .catch(() => setProject(null));
  }, [projectId]);
  useEffect(() => {
    if (!dirty && !contextDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const preventAccidentalNavigation = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (window.confirm("Há alterações não salvas. Sair desta tela e descartar o rascunho?")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", preventAccidentalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", preventAccidentalNavigation, true);
    };
  }, [dirty, contextDirty]);
  if (project === undefined)
    return (
      <div className="grid h-96 place-items-center">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  if (!project)
    return (
      <div className="rounded-[24px] bg-white p-10 text-center">
        <h1 className="font-extrabold">Projeto não encontrado</h1>
      </div>
    );
  function update(patch: Partial<Project>) {
    setProject((current) => (current ? { ...current, ...patch } : current));
    setDirty(true);
  }
  async function save() {
    if (!project) return false;
    const validationError = mode === "simple" ? validateSimpleProject(project) : null;
    if (validationError) { setSaveError(validationError); return false; }
    if (Object.keys(whatsappNumberErrors(projectWhatsAppNumbers(project))).length) {
      setSaveError("Revise os números de WhatsApp destacados antes de salvar.");
      return false;
    }
    setSaveError("");
    setSaving(true);
    try {
      const persisted = await projectRepository.saveProject(project);
      setProject(persisted);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar as configurações.");
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function archive() {
    if (
      !project ||
      !confirm("Arquivar este projeto? A página pública ficará indisponível.")
    )
      return;
    const next = { ...project, status: "archived" as const };
    await projectRepository.saveProject(next);
    setProject(next);
  }
  async function remove() {
    if (
      !project ||
      !confirm(`Excluir “${project.name}” permanentemente?`)
    )
      return;
    await projectRepository.deleteProject(project.id);
    router.push("/app/projects");
  }
  return (
    <div className="mx-auto max-w-5xl animate-enter">
      <Link
        href="/app/projects"
        className="inline-flex items-center gap-2 text-xs font-bold text-[#6f6f79]"
      >
        ← Projetos
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-[-.04em]">Configurações</h1>
      <p className="mt-2 text-sm text-[#74747e]">
        Ensine à SOBE sobre seu negócio e escolha como ela prepara cada contato.
      </p>
      <div role="group" aria-label="Modo de configuração" className="mt-6 inline-flex rounded-xl border border-[#dfe6ee] bg-white p-1">
        <button type="button" aria-pressed={mode === "simple"} onClick={() => setMode("simple")} className={`focus-ring min-h-11 rounded-lg px-5 text-sm font-bold ${mode === "simple" ? "bg-[#0054fc] text-white" : "text-[#536178] hover:bg-[#eef4fa]"}`}>Simples</button>
        <button type="button" aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")} className={`focus-ring min-h-11 rounded-lg px-5 text-sm font-bold ${mode === "advanced" ? "bg-[#0054fc] text-white" : "text-[#536178] hover:bg-[#eef4fa]"}`}>Avançado</button>
      </div>
      {dirty || contextDirty ? <p role="status" className="mt-2 text-sm font-semibold text-[#9a6700]">Há alterações não salvas. Alternar o modo mantém o rascunho nesta tela.</p> : null}
      <div hidden={mode !== "simple"}><SimpleSettings project={project} active={mode === "simple"} onChange={(next) => { setProject(next); setDirty(true); setSaveError(""); }} onContextDirtyChange={setContextDirty} onSave={save} saved={saved} saveError={saveError} dirty={dirty} saving={saving} /></div>
      {mode === "advanced" ? <div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {[
          ["Jornadas e intenções", "Defina caminhos e perguntas por objetivo.", `${project.id}/conversion`],
          ["Destinos e unidades", "Configure atendimento e roteamento.", `${project.id}/operations`],
          ["Páginas e entradas", "Ajuste links, páginas e origens.", `${project.id}/entries`],
          ["Conteúdo e marca", "Edite mídia, textos e identidade.", `${project.id}/editor`],
          ["Resultados e versões", "Consulte dados e histórico publicado.", `${project.id}/analytics`],
        ].map(([title, description, path]) => <Link key={path} href={`/app/projects/${path}`} className="focus-ring min-h-24 rounded-xl border border-[#dfe6ee] bg-white p-4 hover:border-[#0054fc]"><strong className="block text-sm text-[#07172f]">{title}</strong><span className="mt-1 block text-xs text-[#526171]">{description}</span></Link>)}
      </div>
      <details className="mt-6 rounded-2xl border border-[#dfe6ee] bg-white p-5"><summary className="focus-ring cursor-pointer text-sm font-bold text-[#07172f]">Administração, versões e ações do projeto</summary>
      <nav aria-label="Ferramentas avançadas do negócio" className="mt-6 flex gap-2 overflow-x-auto border-y border-[#dfe6ee] py-3">
        <a href="#information" className="focus-ring inline-flex min-h-11 shrink-0 items-center bg-[#07172f] px-4 text-sm font-bold text-white">Informações</a>
        <Link href={`/app/projects/${project.id}/data`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Produtos e serviços</Link>
        <Link href={`/app/projects/${project.id}/data?tab=locations`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Unidades</Link>
        <Link href={`/app/projects/${project.id}/brand`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Marca</Link>
        <Link href={`/app/projects/${project.id}/media`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Mídia</Link>
        <Link href={`/app/projects/${project.id}/sources`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Materiais importados</Link>
        <Link href={`/app/projects/${project.id}/editor`} className="focus-ring inline-flex min-h-11 shrink-0 items-center px-4 text-sm font-bold text-[#536178] hover:bg-[#eef4fa]">Avançado</Link>
      </nav>
      <section id="information" className="mt-7 rounded-[22px] border border-[#e4e3ea] bg-white p-6">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Globe2 size={18} className="text-[#0054fc]" /> Informações públicas
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-name">Nome</Label>
            <Input
              id="project-name"
              value={project.name}
              onChange={(event) => update({ name: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="project-slug">Slug</Label>
            <Input
              id="project-slug"
              value={project.slug}
              onChange={(event) =>
                update({ slug: slugify(event.target.value) })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="project-description">Descrição SEO</Label>
            <Textarea
              id="project-description"
              value={project.description}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>
          <div id="contact" className="contents"><WhatsAppNumbersEditor project={project} onChange={(next) => { setProject(next); setDirty(true); setSaveError(""); }} /></div>
          <div>
            <Label htmlFor="project-status">Situação</Label>
            <Select
              id="project-status"
              value={project.status}
              disabled
              aria-describedby="project-status-help"
            >
              <option value="draft">Rascunho</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </Select>
            <p
              id="project-status-help"
              className="mt-1 text-xs text-[#85858f]"
            >
              Publique pelo editor para executar a validação e criar o snapshot.
            </p>
          </div>
          <div>
            <Label>Indexação</Label>
            <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#dedde6] px-3">
              <input
                type="checkbox"
                defaultChecked
                className="accent-[#0054fc]"
              />
              <span className="text-sm">Permitir mecanismos de busca</span>
            </label>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button onClick={save} disabled={saving || Boolean(Object.keys(whatsappNumberErrors(projectWhatsAppNumbers(project))).length)}>
            <Save size={16} /> {saving ? "Salvando…" : "Salvar"}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15966c]">
              <Check size={14} /> Alterações salvas
            </span>
          )}
        </div>
        {saveError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{saveError}</p> : null}
      </section>
      <section className="mt-5 rounded-[22px] border border-[#e4e3ea] bg-white p-6">
        <h2 className="font-extrabold">Versionamento</h2>
        <p className="mt-1 text-sm text-[#777781]">
          Cada publicação gera um snapshot no banco.
        </p>
        <div className="mt-5 flex items-center gap-4 rounded-[16px] bg-[#f5f4f8] p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ff] font-extrabold text-[#0054fc]">
            v{project.version}
          </span>
          <span className="flex-1">
            <strong className="block text-sm">Versão atual</strong>
            <small className="text-[#85858f]">
              Atualizada em{" "}
              {new Date(project.updatedAt).toLocaleString("pt-BR")}
            </small>
          </span>
          <button
            onClick={() =>
              void projectRepository.saveProject({
                ...project,
                status: "draft",
              })
            }
            className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[#dedde5] bg-white px-3 py-2 text-xs font-bold"
          >
            <RotateCcw size={14} /> Restaurar como rascunho
          </button>
        </div>
      </section>
      <section className="mt-5 rounded-[22px] border border-[#ffd0d0] bg-[#fffafa] p-6">
        <h2 className="flex items-center gap-2 font-extrabold text-[#a93636]">
          <AlertTriangle size={18} /> Zona de risco
        </h2>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger" onClick={archive}>
            Arquivar projeto
          </Button>
          <Button variant="danger" onClick={remove}>
            <Trash2 size={16} /> Excluir projeto
          </Button>
          <button
            onClick={() =>
              void navigator.clipboard.writeText(JSON.stringify(project))
            }
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedde5] bg-white px-4 text-sm font-bold"
          >
            <Copy size={16} /> Copiar backup JSON
          </button>
        </div>
      </section>
      </details>
      </div> : null}
    </div>
  );
}
