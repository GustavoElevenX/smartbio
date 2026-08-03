"use client";

import Link from "next/link";
import {
  BarChart3,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";

export function ProjectsList() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => { void projectRepository.getProjects().then(setProjects); }, []);
  async function duplicate(project: Project) {
    const copy = {
      ...structuredClone(project),
      id: crypto.randomUUID(),
      name: `${project.name} — cópia`,
      slug: `${project.slug}-copia`,
      status: "draft" as const,
      publishedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await projectRepository.saveProject(copy);
    setProjects(await projectRepository.getProjects());
  }
  return (
    <div className="animate-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#6d5ef5]">Projetos</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            Experiências do workspace
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            Crie, publique e acompanhe cada jornada.
          </p>
        </div>
        <Link
          href="/app/projects/new"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17171c] px-4 text-sm font-bold text-white"
        >
          <Plus size={17} /> Novo projeto
        </Link>
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article
            key={project.id}
            className="overflow-hidden rounded-[24px] border border-[#e4e3ea] bg-white shadow-[0_10px_34px_rgba(30,28,50,.05)]"
          >
            <div
              className="relative h-40 overflow-hidden p-5"
              style={{
                background: `linear-gradient(135deg, ${project.designSystem.colors.background}, ${project.designSystem.colors.muted})`,
                color: project.designSystem.colors.foreground,
              }}
            >
              <div
                className="absolute -right-6 -top-8 size-36 rounded-full opacity-30 blur-2xl"
                style={{ background: project.designSystem.colors.primary }}
              />
              <div className="relative flex items-start justify-between">
                <span
                  className="grid size-11 place-items-center rounded-[14px] text-sm font-extrabold shadow-sm"
                  style={{
                    background: project.designSystem.colors.surface,
                    color: project.designSystem.colors.primary,
                  }}
                >
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <button
                  className="focus-ring grid size-9 place-items-center rounded-xl bg-white/70 text-[#4e4e56]"
                  aria-label="Mais opções"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
              <div className="relative mt-7">
                <h2 className="text-xl font-extrabold tracking-[-.035em]">
                  {project.name}
                </h2>
                <p className="mt-1 truncate text-xs opacity-65">
                  {project.description}
                </p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${project.status === "published" ? "bg-[#e8f7ef] text-[#147b58]" : "bg-[#efeff3] text-[#666670]"}`}
                >
                  {project.status === "published" ? "Publicado" : "Rascunho"}
                </span>
                <a
                  href={`/${project.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6053d6]"
                >
                  Abrir <ExternalLink size={13} />
                </a>
              </div>
              <p className="mt-4 text-xs text-[#878791]">
                smart.bio/{project.slug}
              </p>
              <div className="mt-5 grid grid-cols-4 gap-2">
                <Link
                  href={`/app/projects/${project.id}/editor`}
                  title="Editar"
                  className="focus-ring grid h-10 place-items-center rounded-xl bg-[#f1f0f5] text-[#555560]"
                >
                  <Pencil size={16} />
                </Link>
                <Link
                  href={`/app/projects/${project.id}/brand`}
                  title="Marca"
                  className="focus-ring grid h-10 place-items-center rounded-xl bg-[#f1f0f5] text-[#555560]"
                >
                  <Palette size={16} />
                </Link>
                <Link
                  href={`/app/projects/${project.id}/analytics`}
                  title="Analytics"
                  className="focus-ring grid h-10 place-items-center rounded-xl bg-[#f1f0f5] text-[#555560]"
                >
                  <BarChart3 size={16} />
                </Link>
                <button
                  onClick={() => void duplicate(project)}
                  title="Duplicar"
                  className="focus-ring grid h-10 place-items-center rounded-xl bg-[#f1f0f5] text-[#555560]"
                >
                  <Copy size={16} />
                </button>
              </div>
              <Link
                href={`/app/projects/${project.id}/leads`}
                className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#74747e]"
              >
                <Users size={14} /> Ver leads deste projeto
              </Link>
              <Link
                href={`/app/projects/${project.id}/operations`}
                className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#74747e]"
              >
                <MoreHorizontal size={14} /> Ver operação comercial
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
