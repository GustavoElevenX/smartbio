"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  Eye,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { commercialRepository } from "@/lib/repositories/commercial-repository";
import { localStore } from "@/lib/local-store";
import { projectRepository } from "@/lib/repositories/project-repository";
import { formatNumber } from "@/lib/utils";
import type { AnalyticsEvent, CommercialOpportunity, Project } from "@/types";

export function Overview() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  useEffect(() => {
    void projectRepository.getProjects().then(async (items) => {
      setProjects(items);
      const tracked = await Promise.all(items.map((project) => commercialRepository.getEvents(project.id)));
      setEvents(tracked.flat());
      setOpportunities(items.flatMap((project) => localStore.getOpportunities(project.id)));
    });
  }, []);
  const stats = useMemo(() => {
    const views = events.filter(
      (event) => event.eventName === "page_view",
    ).length;
    const sessions = new Set(events.map((event) => event.sessionId)).size;
    const completed = new Set(
      events
        .filter((event) => event.eventName === "journey_completed")
        .map((event) => event.sessionId),
    ).size;
    return {
      views,
      sessions,
      completed,
      rate: sessions ? Math.round((completed / sessions) * 100) : 0,
      whatsapp: events.filter((event) => event.eventName === "whatsapp_clicked")
        .length,
    };
  }, [events]);
  return (
    <div className="animate-enter">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-[#0054fc]">Visão geral</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            O que sua bio conduziu.
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            Acompanhe a jornada, não só os cliques.
          </p>
        </div>
        <Link
          href="/app/onboarding"
          className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0054fc] px-4 text-sm font-bold text-white shadow-[0_8px_22px_rgba(0,84,252,.2)] transition hover:bg-[#0048d9]"
        >
          <Plus size={17} /> Criar experiência
        </Link>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Visitas", stats.views, "Sem comparação ainda", Eye, "#0054fc", "#eaf3ff"],
          [
            "Jornadas concluídas",
            stats.completed,
            `${stats.rate}% de conclusão`,
            Target,
            "#14966b",
            "#e8f8f2",
          ],
          [
            "Oportunidades",
            opportunities.length,
            "Ações comerciais registradas",
            Users,
            "#dc604e",
            "#fff0ed",
          ],
          [
            "Cliques no WhatsApp",
            stats.whatsapp,
            "Conversão direta",
            MessageCircle,
            "#2b9b68",
            "#e9f8ef",
          ],
        ].map(([label, value, note, Icon, color, background]) => {
          const StatIcon = Icon as typeof Eye;
          return (
            <div
              key={String(label)}
              className="rounded-[20px] border border-[#e5e4eb] bg-white p-5 shadow-[0_8px_30px_rgba(30,28,50,.04)]"
            >
              <div className="flex items-start justify-between">
                <span className="text-sm font-semibold text-[#72727c]">
                  {String(label)}
                </span>
                <span
                  className="grid size-9 place-items-center rounded-xl"
                  style={{
                    color: String(color),
                    background: String(background),
                  }}
                >
                  <StatIcon size={18} />
                </span>
              </div>
              <strong className="mt-6 block text-3xl tracking-[-.04em]">
                {formatNumber(Number(value))}
              </strong>
              <span className="mt-2 block text-xs font-medium text-[#84848e]">
                {String(note)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="rounded-[24px] border border-[#e5e4eb] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold">Seus negócios</h2>
              <p className="mt-1 text-xs text-[#84848e]">
                Experiências ativas no workspace
              </p>
            </div>
            <Link
              href="/app/projects"
              className="text-xs font-bold text-[#0054fc]"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {projects.slice(0, 3).map((project) => (
              <div
                key={project.id}
                className="flex flex-wrap items-center gap-4 rounded-[17px] border border-[#ecebf0] p-3.5"
              >
                <div
                  className="grid size-11 place-items-center rounded-[13px] font-extrabold"
                  style={{
                    background: project.designSystem.colors.muted,
                    color: project.designSystem.colors.primary,
                  }}
                >
                  {project.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-[150px] flex-1">
                  <strong className="block text-sm">{project.name}</strong>
                  <span className="text-xs text-[#85858f]">
                    smart.bio/{project.slug}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${project.status === "published" ? "bg-[#e7f7ef] text-[#147a57]" : "bg-[#f0eff4] text-[#686873]"}`}
                >
                  {project.status === "published" ? "Publicado" : "Rascunho"}
                </span>
                <Link
                  href={`/app/projects/${project.id}/editor`}
                  className="focus-ring grid size-9 place-items-center rounded-xl border border-[#e2e1e8] text-[#676771]"
                  aria-label={`Editar ${project.name}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
                <button
                  className="focus-ring grid size-9 place-items-center rounded-xl text-[#898992]"
                  aria-label="Mais opções"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="relative overflow-hidden rounded-[24px] bg-[#07172f] p-6 text-white">
          <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
          <div className="sobe-gradient absolute -right-12 -top-12 size-48 rounded-full opacity-30 blur-3xl" />
          <Sparkles className="relative text-[#02e5cd]" size={22} />
          <h2 className="relative mt-10 text-2xl font-extrabold tracking-[-.035em]">
            Sugestões baseadas em evidência
          </h2>
          <p className="relative mt-3 text-sm leading-6 text-white/60">
            A Sobe só sugere mudanças depois de reunir pelo menos 30 sessões no negócio e 15 na meta analisada.
          </p>
          <Link
            href="/app/projects/demo-vertice/editor"
            className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#01d2df]"
          >
            Ver jornada <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <section className="mt-5 rounded-[24px] border border-[#e5e4eb] bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ff] text-[#0054fc]">
            <BarChart3 size={19} />
          </span>
          <div>
            <h2 className="font-extrabold">Funil resumido</h2>
            <p className="text-xs text-[#84848e]">Todos os projetos</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {[
            ["Visualizações", stats.views],
            ["Intenção", new Set(events.filter((event) => ["conversion_goal_selected", "conversion_goal_resolved"].includes(event.eventName)).map((event) => event.sessionId)).size],
            ["Ação", new Set(events.filter((event) => ["form_submitted", "quote_submitted", "booking_submitted", "order_submitted", "reservation_submitted", "route_resolved"].includes(event.eventName)).map((event) => event.sessionId)).size],
            ["Oportunidade", new Set(opportunities.map((item) => item.sessionId).filter(Boolean)).size],
            ["Conversão", opportunities.filter((item) => item.status === "converted").length],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className="relative rounded-[16px] bg-[#f6f5f9] p-4"
            >
              <strong className="text-xl">{value}</strong>
              <span className="mt-1 block text-xs text-[#777781]">{label}</span>
              {index < 4 && (
                <span className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 rotate-45 border-r border-t border-[#e0dfe7] bg-white sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
