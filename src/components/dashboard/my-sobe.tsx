"use client";

import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";

export function MySobe({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  useEffect(() => {
    void projectRepository.getProject(projectId).then((found) => setProject(found || null)).catch(() => setProject(null));
  }, [projectId]);
  if (project === undefined) return <div className="h-72 animate-pulse rounded-2xl bg-white" aria-label="Carregando sua SOBE" />;
  if (!project) return <p className="rounded-2xl bg-white p-8">Negócio não encontrado.</p>;

  const base = `/app/projects/${project.id}`;
  const preview = `/${encodeURIComponent(project.slug)}/preview`;
  const actions = [
    { label: "Alterar chamada e textos", detail: "Ajuste a apresentação que o visitante lê.", href: `${base}/editor` },
    { label: "Trocar logotipo e cores", detail: "Use a identidade do seu negócio.", href: `${base}/brand` },
    { label: "Escolher imagens", detail: "Organize capa e mídia da página.", href: `${base}/media` },
    { label: "Reorganizar destaques", detail: "Coloque as informações principais em evidência.", href: `${base}/editor` },
    ...(process.env.NEXT_PUBLIC_FEATURE_CONTENT_STUDIO !== "false" ? [{ label: "Criar conteúdo", detail: "Abra as ferramentas de conteúdo.", href: `${base}/content` }] : []),
    { label: "Criar artes com IA", detail: "Produza visuais para sua SOBE.", href: `${base}/visuals` },
  ];

  return <div className="mx-auto max-w-5xl animate-enter">
    <header className="border-b border-[#dfe6ee] pb-7">
      <h1 className="text-3xl font-extrabold tracking-[-.035em] text-[#07172f]">Minha SOBE</h1>
      <p className="mt-2 text-sm text-[#526171]">Veja o que seus visitantes encontram e ajuste a apresentação do negócio.</p>
    </header>
    <section className="mt-7 grid gap-6 rounded-2xl border border-[#dfe6ee] bg-white p-6 sm:p-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="flex flex-col items-start justify-center"><h2 className="text-xl font-bold text-[#07172f]">{project.name}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#526171]">{project.description || "Adicione uma breve descrição para apresentar seu negócio."}</p><p className="mt-3 text-xs font-semibold text-[#526171]">{project.status === "published" ? "Versão publicada disponível" : "Rascunho ainda não publicado"}</p><Link href={preview} target="_blank" rel="noopener noreferrer" className="focus-ring mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0054fc] px-5 text-sm font-bold text-white hover:bg-[#0048d9]">Testar minha SOBE <ExternalLink size={16} aria-hidden="true" /></Link></div>
      <div className="overflow-hidden rounded-xl border border-[#dfe6ee] bg-[#f7f8fa]"><p className="border-b border-[#dfe6ee] px-4 py-2 text-xs font-bold text-[#526171]">Prévia como visitante · ambiente de teste</p><div className="h-[480px] overflow-y-auto"><ExperienceCanvas project={project} preview /></div></div>
    </section>
    <section className="mt-8" aria-labelledby="my-sobe-actions"><h2 id="my-sobe-actions" className="text-lg font-bold text-[#07172f]">O que deseja ajustar?</h2><div className="mt-4 divide-y divide-[#dfe6ee] border-y border-[#dfe6ee]">{actions.map((action) => <Link key={action.label} href={action.href} className="focus-ring flex min-h-20 items-center justify-between gap-5 px-2 py-4 hover:bg-white"><span><strong className="block text-sm text-[#07172f]">{action.label}</strong><small className="mt-1 block text-xs text-[#526171]">{action.detail}</small></span><ArrowRight size={17} className="shrink-0 text-[#0054fc]" aria-hidden="true" /></Link>)}</div></section>
    <Link href={`${base}/settings`} className="focus-ring mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#0054fc]">Configurar como a SOBE atende <ArrowRight size={16} aria-hidden="true" /></Link>
  </div>;
}
