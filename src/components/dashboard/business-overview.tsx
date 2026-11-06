"use client";

import Link from "next/link";
import { ArrowRight, Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { projectRepository } from "@/lib/repositories/project-repository";
import { localStore } from "@/lib/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { features } from "@/lib/constants";
import type { Project } from "@/types";

export function BusinessOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [opportunityCount, setOpportunityCount] = useState<number>();
  const [campaigns, setCampaigns] = useState({ active: 0, scheduled: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void projectRepository.getProject(projectId).then(async (found) => {
      setProject(found || null);
      if (!found) return;
      if (isSupabaseConfigured()) {
        void fetch(`/api/projects/${found.id}/analytics/overview?from=${encodeURIComponent(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())}`)
          .then((response) => response.json())
          .then((payload: { data?: { opportunities?: number } }) => setOpportunityCount(payload.data?.opportunities || 0))
          .catch(() => undefined);
      } else {
        setOpportunityCount(localStore.getOpportunities(found.id).length);
      }
      if (features.activations) void fetch(`/api/projects/${found.id}/activations`)
        .then((response) => response.ok ? response.json() : null)
        .then((payload: { data?: { activations?: Array<{ status: string }> } } | null) => {
          const items = payload?.data?.activations || [];
          setCampaigns({ active: items.filter((item) => item.status === "active").length, scheduled: items.filter((item) => item.status === "scheduled").length });
        }).catch(() => undefined);
    }).catch(() => setProject(null));
  }, [projectId]);

  if (project === undefined) return <div className="h-72 animate-pulse rounded-2xl bg-white" aria-label="Carregando início do negócio" />;
  if (!project) return <p className="rounded-2xl bg-white p-8 text-sm text-[#526171]">Negócio não encontrado.</p>;

  const base = `/app/projects/${project.id}`;
  const publicPath = `/${encodeURIComponent(project.slug)}`;
  const published = project.status === "published";
  const nextAction = !project.description.trim()
    ? { label: "Conte sobre seu negócio", href: `${base}/settings` }
    : !project.phone && !(project.commercialConfig?.routingDestinations || []).some((item) => item.type === "whatsapp" && item.value)
      ? { label: "Configure o atendimento", href: `${base}/settings` }
      : !published
        ? { label: "Revise e publique", href: `${base}/launch` }
        : { label: "Veja as oportunidades", href: `${base}/opportunities` };

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return <div className="mx-auto max-w-5xl animate-enter">
    <header className="border-b border-[#dfe6ee] pb-7">
      <p className="text-sm font-semibold text-[#526171]">{project.name}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-.035em] text-[#07172f]">Início</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526171]">Acompanhe sua SOBE e o próximo passo para receber contatos úteis.</p>
    </header>
    <section className="mt-7 grid gap-6 rounded-2xl bg-[#07172f] p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center" aria-labelledby="publication-title">
      <div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${published ? "bg-[#dbf8ed] text-[#086b4d]" : "bg-[#fff4d8] text-[#795300]"}`}>{published ? "Publicada" : project.status === "archived" ? "Arquivada" : "Rascunho"}</span>
        <h2 id="publication-title" className="mt-4 text-xl font-bold">Sua SOBE {published ? "está no ar" : "está em preparação"}</h2>
        <p className="mt-2 break-all text-sm text-[#d5e0ee]">{publicPath}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyLink()} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#07172f] hover:bg-[#eaf3ff]">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Link copiado" : "Copiar link"}</button>
        <Link href={`${publicPath}/preview`} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#8fa1b8] px-4 text-sm font-bold text-white hover:bg-[#0b2446]">Testar minha SOBE <ExternalLink size={15} aria-hidden="true" /></Link>
      </div>
    </section>
    <section className="mt-7 grid gap-5 border-y border-[#dfe6ee] py-5 sm:grid-cols-3" aria-label="Resumo do negócio">
      <div><strong className="block text-2xl text-[#07172f]">{opportunityCount ?? "—"}</strong><span className="text-sm text-[#526171]">oportunidades neste mês</span></div>
      {features.activations ? <><div><strong className="block text-2xl text-[#07172f]">{campaigns.active}</strong><span className="text-sm text-[#526171]">campanhas ativas</span></div><div><strong className="block text-2xl text-[#07172f]">{campaigns.scheduled}</strong><span className="text-sm text-[#526171]">campanhas programadas</span></div></> : null}
    </section>
    <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-[#dfe6ee] bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-lg font-bold text-[#07172f]">Próxima ação</h2><p className="mt-1 text-sm text-[#526171]">{published ? "Veja quem procurou seu negócio e continue o atendimento." : "Complete o essencial e confira a experiência antes de publicar."}</p></div>
      <Link href={nextAction.href} className="focus-ring inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white hover:bg-[#0048d9]">{nextAction.label}<ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-[#0054fc]">
      <Link href={`${base}/opportunities`} className="focus-ring inline-flex min-h-11 items-center hover:underline">Oportunidades</Link>
      {features.activations ? <Link href={`${base}/activations`} className="focus-ring inline-flex min-h-11 items-center hover:underline">Campanhas</Link> : null}
      <Link href={`${base}/minha-sobe`} className="focus-ring inline-flex min-h-11 items-center hover:underline">Minha SOBE</Link>
      <Link href={`${base}/analytics`} className="focus-ring inline-flex min-h-11 items-center hover:underline">Resultados detalhados</Link>
    </div>
  </div>;
}
