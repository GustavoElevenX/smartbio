"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Globe2,
  MousePointerClick,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { projectRepository } from "@/lib/repositories/project-repository";
import { commercialRepository } from "@/lib/repositories/commercial-repository";
import { localStore } from "@/lib/local-store";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { AnalyticsEvent, CommercialOpportunity, Project } from "@/types";

export function BusinessOverview({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>(
    [],
  );
  const [remoteStats, setRemoteStats] = useState<{
    visits: number;
    intentions: number;
    opportunities: number;
    conversions: number;
  }>();
  const [activationStats, setActivationStats] = useState({ active: 0, scheduled: 0 });
  useEffect(() => {
    void projectRepository
      .getProject(projectId)
      .then(async (found) => {
        setProject(found || null);
        if (!found) return;
        void fetch(`/api/projects/${found.id}/activations`).then(async (response) => { if (!response.ok) return; const payload = await response.json() as { data?: { activations?: Array<{ status: string }> } }; const activations = payload.data?.activations || []; setActivationStats({ active: activations.filter((item) => item.status === "active").length, scheduled: activations.filter((item) => item.status === "scheduled").length }); }).catch(() => undefined);
        if (isSupabaseConfigured()) {
          const response = await fetch(
            `/api/projects/${found.id}/analytics/overview?from=${encodeURIComponent(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())}`,
          );
          const payload = (await response.json()) as {
            data?: {
              sessions: number;
              opportunities: number;
              conversions: number;
              funnel?: Array<{ key: string; sessions: number }>;
            };
          };
          if (payload.data)
            setRemoteStats({
              visits: payload.data.sessions,
              intentions:
                payload.data.funnel?.find((stage) => stage.key === "intention")
                  ?.sessions || 0,
              opportunities: payload.data.opportunities,
              conversions: payload.data.conversions,
            });
          return;
        }
        setEvents(await commercialRepository.getEvents(found.id));
        setOpportunities(localStore.getOpportunities(found.id));
      })
      .catch(() => setProject(null));
  }, [projectId]);
  const localStats = useMemo(
    () => ({
      visits: new Set(
        events
          .filter((event) =>
            ["page_view", "presence_page_viewed"].includes(event.eventName),
          )
          .map((event) => event.sessionId),
      ).size,
      intentions: new Set(
        events
          .filter((event) =>
            ["conversion_goal_selected", "conversion_goal_resolved"].includes(
              event.eventName,
            ),
          )
          .map((event) => event.sessionId),
      ).size,
      opportunities: opportunities.length,
      conversions: opportunities.filter((item) => item.status === "converted")
        .length,
    }),
    [events, opportunities],
  );
  const stats = remoteStats || localStats;
  if (project === undefined)
    return <div className="h-96 animate-pulse rounded-[24px] bg-white" />;
  if (!project)
    return (
      <>
      <div className="rounded-[24px] bg-white p-10 text-center">
        Negócio não encontrado.
      </div>
      {/*
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-[24px] border border-[#e4e2e9] bg-white p-6">
          <Zap className="text-[#6657d8]" size={20} />
          <h2 className="mt-5 text-xl font-black">Ativações</h2>
          <p className="mt-2 text-sm text-[#74717d]">{activationStats.active} ativas · {activationStats.scheduled} agendadas</p>
          <p className="mt-5 text-sm leading-6 text-[#686570]">Faça o site acompanhar promoções, lançamentos, agenda e o que precisa vender agora.</p>
          <Link href={`/app/projects/${project.id}/activations`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedbe8] px-4 text-sm font-bold text-[#5c4ed0]">Ver ativações <ArrowRight size={15}/></Link>
        </div>
        <div className="rounded-[24px] bg-[#1d1b26] p-6 text-white">
          <h2 className="text-xl font-black">O que você quer melhorar agora?</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">Transforme o momento do negócio em um rascunho editável. A IA não publica nada sozinha.</p>
          <Link href={`/app/projects/${project.id}/activations/new`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#201d2a]">Criar uma ativação <ArrowRight size={16}/></Link>
        </div>
      </section>
      */}
      </>
    );
  const pages = project.presence?.pages || [];
  return (
    <div className="animate-enter">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold text-[#6657d8]">{project.name}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-[-.045em] sm:text-4xl">
            Sua presença está transformando atenção em oportunidade?
          </h1>
          <p className="mt-3 text-sm text-[#74717d]">
            Acompanhe o caminho completo — da visita à conversão confirmada.
          </p>
        </div>
        <Link
          href={`/app/projects/${project.id}/site`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17171c] px-4 text-sm font-bold text-white"
        >
          <Globe2 size={17} />
          Editar site
        </Link>
      </header>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Visitas", stats.visits, Eye],
          ["Intenções", stats.intentions, MousePointerClick],
          ["Oportunidades", stats.opportunities, Users],
          ["Conversões", stats.conversions, CheckCircle2],
        ].map(([label, value, Icon]) => {
          const CardIcon = Icon as typeof Eye;
          return (
            <div
              key={String(label)}
              className="rounded-[20px] border border-[#e4e2e9] bg-white p-5"
            >
              <CardIcon size={18} className="text-[#6657d8]" />
              <strong className="mt-7 block text-3xl">{Number(value)}</strong>
              <span className="mt-1 text-sm font-bold text-[#6f6b76]">
                {String(label)}
              </span>
            </div>
          );
        })}
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-[24px] border border-[#e4e2e9] bg-white p-6">
          <Zap className="text-[#6657d8]" size={20} />
          <h2 className="mt-5 text-xl font-black">Ativações</h2>
          <p className="mt-2 text-sm text-[#74717d]">{activationStats.active} ativas · {activationStats.scheduled} agendadas</p>
          <p className="mt-5 text-sm leading-6 text-[#686570]">Faça o site acompanhar promoções, lançamentos, agenda e o que precisa vender agora.</p>
          <Link href={`/app/projects/${project.id}/activations`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedbe8] px-4 text-sm font-bold text-[#5c4ed0]">Ver ativações <ArrowRight size={15} /></Link>
        </div>
        <div className="rounded-[24px] bg-[#1d1b26] p-6 text-white">
          <h2 className="text-xl font-black">O que você quer melhorar agora?</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">Transforme o momento do negócio em um rascunho editável. A IA não publica nada sozinha.</p>
          <Link href={`/app/projects/${project.id}/activations/new`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#201d2a]">Criar uma ativação <ArrowRight size={16} /></Link>
        </div>
      </section>
      {pages.length ? (
        <section className="mt-6 rounded-[24px] border border-[#e4e2e9] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Estrutura publicada</h2>
              <p className="mt-1 text-xs text-[#77737f]">
                Dados reais do projeto atual.
              </p>
            </div>
            <Link
              href={`/app/projects/${project.id}/analytics`}
              className="text-xs font-black text-[#5c4ed0]"
            >
              Ver analytics <ArrowRight className="inline" size={14} />
            </Link>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [
                project.status === "published"
                  ? "Site publicado"
                  : "Site em rascunho",
                Globe2,
              ],
              [`${pages.length} página${pages.length === 1 ? "" : "s"}`, Eye],
              [`${project.conversionGoals?.length || 0} objetivos`, Target],
              [
                `${project.entryPoints?.length || 0} entradas`,
                MousePointerClick,
              ],
              [`${stats.opportunities} oportunidades este mês`, Users],
            ].map(([text, Icon]) => {
              const ItemIcon = Icon as typeof Globe2;
              return (
                <div
                  key={String(text)}
                  className="rounded-2xl bg-[#f6f5f8] p-4"
                >
                  <ItemIcon size={16} className="text-[#6657d8]" />
                  <strong className="mt-5 block text-sm">{String(text)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-[26px] border border-dashed border-[#cbc7d5] bg-white p-8 sm:p-10">
          <Sparkles className="text-[#6657d8]" />
          <h2 className="mt-5 text-2xl font-black">
            Sua presença ainda não está no ar.
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#716d78]">
            A Sobe pode criar sua primeira versão usando:
          </p>
          <ul className="mt-4 grid gap-2 text-sm font-bold text-[#514d58] sm:grid-cols-2">
            {[
              "sua descrição",
              "sua logo",
              "seu site atual",
              "seus PDFs",
              "seus produtos e serviços",
            ].map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          <Link
            href="/app/onboarding/ai"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17171c] px-4 text-sm font-bold text-white"
          >
            Criar com IA <ArrowRight size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}
