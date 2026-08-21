"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clipboard, ExternalLink, LoaderCircle, Monitor, Pencil, Rocket, Smartphone } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { PublishReadinessModal } from "@/components/publishing/publish-readiness-modal";
import { getProjectReadiness } from "@/features/publishing/project-readiness";
import { presentProjectReadiness } from "@/features/publishing/readiness-presentation";
import { projectRepository } from "@/lib/repositories/project-repository";
import type { Project } from "@/types";

export function ProjectLaunchReview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => {
    void projectRepository.getProject(projectId).then((found) => setProject(found || null)).catch(() => setProject(null));
  }, [projectId]);
  const readiness = useMemo(() => project ? presentProjectReadiness(project, getProjectReadiness(project)) : undefined, [project]);

  if (project === undefined) return <div className="grid min-h-[520px] place-items-center"><LoaderCircle className="animate-spin text-[#0054fc]" /><span className="sr-only">Carregando primeira versão</span></div>;
  if (!project) return <div className="border border-[#dfe6ee] bg-white p-10 text-center"><h1 className="text-2xl font-extrabold">Negócio não encontrado</h1><Link href="/app/projects" className="mt-4 inline-flex text-sm font-bold text-[#0054fc]">Voltar aos negócios</Link></div>;
  const home = project.presence?.pages.find((page) => page.isHome) || project.presence?.pages[0];
  const publicPath = `/${project.slug}`;

  async function copyLink() {
    const url = `${window.location.origin}${publicPath}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <div className="mx-auto max-w-[1480px] animate-enter">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfe6ee] bg-white px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-5"><Brand size="sm" /><span className="h-8 w-px bg-[#dfe6ee]" /><div className="min-w-0"><strong className="block truncate text-sm text-[#07172f]">{project.name}</strong><span className={`mt-1 inline-flex text-xs font-extrabold uppercase tracking-[.1em] ${project.status === "published" ? "text-[#14845d]" : "text-[#687582]"}`}>{project.status === "published" ? "Publicado" : "Rascunho"}</span></div></div>
      <div className="flex flex-wrap gap-2"><Link href={`/app/projects/${project.id}/site`} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d7e1ec] bg-white px-4 text-sm font-semibold text-[#07172f] hover:border-[#9fc3ff] hover:bg-[#f7fbff]"><Pencil size={16} />Editar página</Link><Button onClick={() => setPublishOpen(true)}><Rocket size={16} />{project.status === "published" ? "Publicar alterações" : "Publicar"}</Button></div>
    </header>

    <div className="px-1 py-8 sm:px-2 lg:py-10">
      <h1 className="max-w-4xl text-4xl font-extrabold tracking-[-.045em] text-[#07172f] sm:text-5xl">{project.status === "published" ? "Sua Sobe está no ar." : "Sua primeira versão está pronta."}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-[#536178]">{project.status === "published" ? "Compartilhe o link principal e acompanhe o que as pessoas fazem a partir dele." : "Teste como um visitante. Se algo estiver faltando, a Sobe mostra exatamente o que precisa ser resolvido antes de publicar."}</p>

      {project.status === "published" ? <section className="mt-8 border border-[#b9e4cf] bg-[#effaf4] p-5" style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)" }}><div className="flex flex-wrap items-center justify-between gap-4"><div><strong className="flex items-center gap-2 text-lg"><CheckCircle2 className="text-[#14845d]" />Link principal</strong><span className="mt-2 block text-sm text-[#526b61]">{publicPath}</span></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Link copiado" : "Copiar link"}</Button><a href={publicPath} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d7e1ec] bg-white px-4 text-sm font-semibold text-[#07172f] hover:border-[#9fc3ff] hover:bg-[#f7fbff]"><ExternalLink size={16} />Abrir página</a><Link href={`/app/projects/${project.id}/analytics`} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0054fc] px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,84,252,.22)] hover:bg-[#0048d9]">Ver resultados</Link></div></div></section> : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-w-0 border border-[#b9c7d6] bg-white" style={{ clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)" }}>
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#dfe6ee] px-5"><span className="text-sm font-bold text-[#07172f]">Modo de visualização — nenhuma ação real será enviada</span><div className="flex gap-1"><button type="button" aria-label="Visualização desktop" onClick={() => setDevice("desktop")} className={`focus-ring grid size-11 place-items-center ${device === "desktop" ? "border-b-2 border-[#0054fc] text-[#0054fc]" : "text-[#718096]"}`}><Monitor size={18} /></button><button type="button" aria-label="Visualização mobile" onClick={() => setDevice("mobile")} className={`focus-ring grid size-11 place-items-center ${device === "mobile" ? "border-b-2 border-[#0054fc] text-[#0054fc]" : "text-[#718096]"}`}><Smartphone size={18} /></button></div></div>
          <div className="h-[720px] overflow-auto bg-[#dfe5eb] p-3 sm:p-5"><div className={`mx-auto min-h-full overflow-hidden bg-white shadow-[0_24px_70px_rgba(7,23,47,.16)] transition-[width] ${device === "mobile" ? "w-[390px] max-w-full" : "w-full"}`}>{home ? <PublicPresencePage project={project} page={home} preview /> : <div className="grid min-h-[520px] place-items-center p-8 text-center"><div><h2 className="text-xl font-extrabold">A página ainda não foi criada</h2><Link href={`/app/projects/${project.id}/site`} className="mt-4 inline-flex text-sm font-bold text-[#0054fc]">Criar página</Link></div></div>}</div></div>
        </section>

        <aside className="h-fit border border-[#b9c7d6] bg-white p-5 sm:p-6" style={{ clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)" }}>
          <h2 className="text-xl font-extrabold tracking-[-.03em] text-[#07172f]">Pronto para publicar: {readiness?.ready || 0} de {readiness?.total || 0}</h2>
          <div className="mt-5 divide-y divide-[#dfe6ee] border-y border-[#dfe6ee]">{readiness?.items.map((item) => <div key={item.id} className="py-4"><div className="flex items-start gap-3">{item.status === "complete" ? <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#02e5cd] text-[#07172f]"><Check size={15} /></span> : <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff2cc] text-[#8a6412]"><AlertTriangle size={15} /></span>}<div className="min-w-0"><strong className="block text-sm text-[#07172f]">{item.title}</strong><p className="mt-1 text-xs leading-5 text-[#687582]">{item.description}</p>{item.status !== "complete" && item.actionPath ? <Link href={item.actionPath} className="mt-3 inline-flex min-h-10 items-center text-xs font-extrabold text-[#0054fc] underline decoration-[#9fc3ff] underline-offset-4">{item.actionLabel || "Resolver agora"}</Link> : null}</div></div></div>)}</div>
          {!readiness?.publishable ? <p className="mt-5 text-xs leading-5 text-[#687582]">Resolva os itens sinalizados para liberar a publicação. As demais configurações avançadas podem ser feitas depois.</p> : <Button className="mt-5 w-full" size="lg" onClick={() => setPublishOpen(true)}><Rocket size={16} />Publicar agora</Button>}
        </aside>
      </div>
    </div>
    <PublishReadinessModal open={publishOpen} onOpenChange={setPublishOpen} project={project} onPublished={setProject} />
  </div>;
}
