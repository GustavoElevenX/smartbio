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
import { projectRepository } from "@/lib/repositories/project-repository";
import { slugify } from "@/lib/utils";
import type { Project } from "@/types";

export function SettingsNav({
  active,
}: {
  active: "profile" | "workspace" | "billing";
}) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto">
      {[
        ["profile", "Perfil", User],
        ["workspace", "Workspace", Users],
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
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void projectRepository
      .getProject(projectId)
      .then((found) => setProject(found || null))
      .catch(() => setProject(null));
  }, [projectId]);
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
  }
  async function save() {
    if (!project) return;
    await projectRepository.saveProject(project);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
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
      <h1 className="mt-4 text-3xl font-extrabold tracking-[-.04em]">
        Configurações do projeto
      </h1>
      <p className="mt-2 text-sm text-[#74747e]">
        URL, SEO, publicação e versões.
      </p>
      <section className="mt-7 rounded-[22px] border border-[#e4e3ea] bg-white p-6">
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
          <div>
            <Label htmlFor="project-status">Status</Label>
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
          <Button onClick={save}>
            <Save size={16} /> Salvar
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#15966c]">
              <Check size={14} /> Alterações salvas
            </span>
          )}
        </div>
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
    </div>
  );
}
