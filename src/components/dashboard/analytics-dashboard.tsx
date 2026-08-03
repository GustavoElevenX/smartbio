"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Eye,
  Filter,
  MousePointerClick,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { commercialRepository } from "@/lib/repositories/commercial-repository";
import { projectRepository } from "@/lib/repositories/project-repository";
import { downloadCsv, formatNumber } from "@/lib/utils";
import type { AnalyticsEvent, Project } from "@/types";

export function AnalyticsDashboard({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [period, setPeriod] = useState("7 dias");
  const [source, setSource] = useState("Todas");
  useEffect(() => {
    let active = true;
    void Promise.all([
      projectRepository.getProject(projectId),
      commercialRepository.getEvents(projectId),
      commercialRepository.getLeads(projectId),
    ])
      .then(([found, tracked, leads]) => {
        if (!active) return;
        setProject(found || null);
        setEvents(tracked);
        setLeadCount(leads.length);
      })
      .catch(() => {
        if (active) setProject(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  const dayCount = period === "Hoje" ? 1 : period === "30 dias" ? 30 : 7;
  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - (dayCount - 1));
        return (
          new Date(event.createdAt) >= cutoff &&
          (source === "Todas" || event.utmSource === source.toLowerCase())
        );
      }),
    [dayCount, events, source],
  );
  const data = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (dayCount - 1 - index));
        const key = date.toISOString().slice(0, 10);
        return {
          day: new Intl.DateTimeFormat(
            "pt-BR",
            dayCount > 7
              ? { day: "2-digit", month: "2-digit" }
              : { weekday: "short" },
          )
            .format(date)
            .replace(".", ""),
          visitas: filtered.filter(
            (event) =>
              event.eventName === "page_view" &&
              event.createdAt.startsWith(key),
          ).length,
          leads: filtered.filter(
            (event) =>
              [
                "form_submitted",
                "quote_submitted",
                "booking_submitted",
                "order_submitted",
                "reservation_submitted",
              ].includes(event.eventName) && event.createdAt.startsWith(key),
          ).length,
        };
      }),
    [dayCount, filtered],
  );
  if (project === undefined)
    return <div className="h-96 animate-pulse rounded-[24px] bg-white" />;
  if (!project)
    return (
      <div className="rounded-[24px] bg-white p-10 text-center">
        <h1 className="font-extrabold">Projeto não encontrado</h1>
        <Link
          href="/app/projects"
          className="mt-4 inline-flex text-sm font-bold text-[#6255d8]"
        >
          Voltar
        </Link>
      </div>
    );
  const sessions = new Set(filtered.map((event) => event.sessionId));
  const completed = new Set(
    filtered
      .filter((event) => event.eventName === "journey_completed")
      .map((event) => event.sessionId),
  );
  const views = filtered.filter(
    (event) => event.eventName === "page_view",
  ).length;
  const rate = sessions.size
    ? Math.round((completed.size / sessions.size) * 100)
    : 0;
  const leads = leadCount;
  const funnel = [
    ["Visualizações", views],
    [
      "Intenção selecionada",
      filtered.filter((event) => event.eventName === "option_clicked").length,
    ],
    [
      "Qualificação iniciada",
      filtered.filter((event) => event.eventName === "form_started").length,
    ],
    [
      "Recomendação vista",
      filtered.filter((event) => event.eventName === "recommendation_viewed")
        .length,
    ],
    [
      "CTA clicado",
      filtered.filter((event) =>
        ["cta_clicked", "whatsapp_clicked", "external_link_clicked"].includes(
          event.eventName,
        ),
      ).length,
    ],
    ["Lead capturado", leads],
  ];
  const sources = [
    ...new Set(events.map((event) => event.utmSource).filter(Boolean)),
  ] as string[];
  return (
    <div className="animate-enter">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/app/projects"
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#6f6f79]"
          >
            <ArrowLeft size={14} /> Projetos
          </Link>
          <p className="text-sm font-semibold text-[#6d5ef5]">{project.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            Analytics da jornada
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            Entenda decisões, avanço e abandono.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/projects/${project.id}/operations`}
            className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-[#17171c] px-4 text-xs font-bold text-white"
          >
            Operação comercial
          </Link>
          <div className="flex rounded-xl border border-[#dfdee6] bg-white p-1">
            {["Hoje", "7 dias", "30 dias"].map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${period === item ? "bg-[#17171c] text-white" : "text-[#777781]"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <select
            aria-label="Filtrar origem"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="min-h-11 rounded-xl border border-[#dfdee6] bg-white px-3 text-xs font-bold"
          >
            <option>Todas</option>
            {sources.map((item) => (
              <option key={item}>
                {item[0].toUpperCase() + item.slice(1)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv(`analytics-${project.slug}.csv`, [
                ["evento", "sessao", "origem", "campanha", "data"],
                ...filtered.map((event) => [
                  event.eventName,
                  event.sessionId,
                  event.utmSource,
                  event.utmCampaign,
                  event.createdAt,
                ]),
              ])
            }
          >
            <Download size={16} /> CSV
          </Button>
        </div>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Visitas", views, Eye, period],
          [
            "Visitantes únicos",
            new Set(filtered.map((event) => event.visitorId)).size,
            Users,
            "no período",
          ],
          [
            "Taxa de conclusão",
            `${rate}%`,
            Target,
            `${completed.size} jornadas`,
          ],
          [
            "Cliques em CTA",
            filtered.filter((event) => event.eventName.includes("clicked"))
              .length,
            MousePointerClick,
            "todos os destinos",
          ],
        ].map(([label, value, Icon, note]) => {
          const StatIcon = Icon as typeof Eye;
          return (
            <div
              key={String(label)}
              className="rounded-[20px] border border-[#e5e4eb] bg-white p-5"
            >
              <div className="flex justify-between">
                <span className="text-sm font-semibold text-[#73737d]">
                  {String(label)}
                </span>
                <StatIcon size={18} className="text-[#6558db]" />
              </div>
              <strong className="mt-6 block text-3xl tracking-[-.04em]">
                {typeof value === "number"
                  ? formatNumber(value)
                  : String(value)}
              </strong>
              <span className="mt-2 block text-xs text-[#898993]">
                {String(note)}
              </span>
            </div>
          );
        })}
      </div>
      <section className="mt-5 rounded-[24px] border border-[#e5e4eb] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold">Conversões comerciais</h2>
            <p className="mt-1 text-xs text-[#85858f]">
              Ações concluídas por capacidade no período selecionado.
            </p>
          </div>
          <Link
            href={`/app/projects/${project.id}/operations`}
            className="text-xs font-bold text-[#6255d8]"
          >
            Ver solicitações →
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Orçamentos", "quote_submitted"],
            ["Agendamentos", "booking_submitted"],
            ["Pedidos", "order_submitted"],
            ["Reservas", "reservation_submitted"],
            ["Rotas resolvidas", "route_resolved"],
          ].map(([label, eventName]) => (
            <div key={eventName} className="rounded-[16px] bg-[#f5f4f8] p-4">
              <span className="text-xs text-[#777781]">{label}</span>
              <strong className="mt-2 block text-2xl">
                {
                  filtered.filter((event) => event.eventName === eventName)
                    .length
                }
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="rounded-[24px] border border-[#e5e4eb] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold">Desempenho</h2>
              <p className="mt-1 text-xs text-[#85858f]">
                Visitas e conversões em {period.toLowerCase()}
              </p>
            </div>
            <ArrowUpRight size={18} className="text-[#15966c]" />
          </div>
          <div className="mt-6 h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="visits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6D5EF5" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#6D5EF5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eeedf2" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 14,
                    border: "1px solid #e4e3ea",
                    boxShadow: "0 12px 30px rgba(0,0,0,.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="visitas"
                  stroke="#6D5EF5"
                  strokeWidth={3}
                  fill="url(#visits)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-[24px] border border-[#e5e4eb] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold">Origens</h2>
              <p className="mt-1 text-xs text-[#85858f]">
                Como as pessoas chegam
              </p>
            </div>
            <Filter size={17} className="text-[#777781]" />
          </div>
          <div className="mt-7 space-y-5">
            {["instagram", "direct", "youtube"].map((item, index) => {
              const count = filtered.filter(
                (event) =>
                  event.eventName === "page_view" && event.utmSource === item,
              ).length;
              const total = Math.max(1, views);
              return (
                <div key={item}>
                  <div className="flex justify-between text-xs">
                    <strong className="capitalize">
                      {item === "direct" ? "Direto" : item}
                    </strong>
                    <span className="text-[#777781]">
                      {count} · {Math.round((count / total) * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eeedf2]">
                    <div
                      className="h-full rounded-full bg-[#6d5ef5]"
                      style={{
                        width: `${Math.min(100, (count / total) * 100)}%`,
                        opacity: 1 - index * 0.2,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <section className="mt-5 rounded-[24px] border border-[#e5e4eb] bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-extrabold">Funil da experiência</h2>
            <p className="mt-1 text-xs text-[#85858f]">
              A etapa de qualificação concentra o maior abandono
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#fff0ed] px-3 py-1.5 text-xs font-bold text-[#c65343]">
            Maior saída: qualificação
          </span>
        </div>
        <div className="mt-7 grid gap-3 lg:grid-cols-6">
          {funnel.map(([label, value], index) => {
            const number = Number(value);
            const percent =
              index === 0
                ? 100
                : Math.min(
                    100,
                    Math.round(
                      (number / Math.max(1, Number(funnel[0][1]))) * 100,
                    ),
                  );
            return (
              <div key={String(label)} className="relative">
                <div className="flex min-h-32 flex-col justify-end overflow-hidden rounded-[17px] bg-[#f5f4f8] p-4">
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[#6d5ef5]/[.07]"
                    style={{ height: `${Math.max(10, percent)}%` }}
                  />
                  <strong className="relative text-xl">{number}</strong>
                  <span className="relative mt-1 text-[11px] leading-4 text-[#73737d]">
                    {String(label)}
                  </span>
                  <small className="relative mt-2 font-bold text-[#6558db]">
                    {percent}%
                  </small>
                </div>
                {index < funnel.length - 1 && (
                  <span className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 rotate-45 border-r border-t border-[#dedde5] bg-white lg:block" />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
