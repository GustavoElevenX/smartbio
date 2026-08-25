"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  ExternalLink,
  Globe2,
  Plus,
  Route,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import type { WorkspaceOperationalOverview } from "@/features/dashboard/operational-overview";
import { resolveNextBestAction } from "@/features/dashboard/next-best-action";
import { formatNumber } from "@/lib/utils";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function nextActionHref(
  key: ReturnType<typeof resolveNextBestAction>["key"],
  projectId?: string,
) {
  if (key === "create") return "/app/onboarding";
  if (key === "upgrade") return "/app/settings/billing";
  if (!projectId) return "/app/projects";
  if (key === "publish") return `/app/projects/${projectId}/launch`;
  if (key === "distribute") return `/app/projects/${projectId}/entries`;
  if (key === "confirm") return `/app/projects/${projectId}/opportunities`;
  if (key === "optimize" || key === "friction")
    return `/app/projects/${projectId}/analytics`;
  return `/app/projects/${projectId}/site`;
}

function observedDays(overview: WorkspaceOperationalOverview) {
  const published = overview.projects
    .map((project) => project.publishedAt)
    .filter((date): date is string => Boolean(date))
    .sort()[0];
  if (!published) return 0;
  return Math.max(
    0,
    Math.floor(
      (new Date(overview.periodEnd).getTime() - new Date(published).getTime()) /
        86_400_000,
    ),
  );
}

export function Overview({
  overview,
}: {
  overview: WorkspaceOperationalOverview;
}) {
  const primary =
    overview.projects.find((project) => project.status === "published") ||
    overview.projects[0];
  const published = overview.projects.some(
    (project) => project.status === "published",
  );
  const nextAction = resolveNextBestAction({
    hasProjects: overview.projects.length > 0,
    published,
    ...overview.totals,
  });
  const days = observedDays(overview);
  const sessionsProgress = Math.min(
    100,
    Math.round((overview.totals.sessions / 30) * 100),
  );
  const daysProgress = Math.min(100, Math.round((days / 30) * 100));
  const learning = overview.totals.sessions < 30 || days < 30;

  useEffect(() => {
    const projectIds = overview.projects
      .map((project) => project.id)
      .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (!projectIds.length) return;
    void fetch("/api/product-state/overview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectIds }),
    });
  }, [overview.projects]);

  const metrics = useMemo(
    () =>
      [
        ["Sessões", overview.totals.sessions],
        ["Intenções", overview.totals.intentions],
        ["Ações", overview.totals.actions],
        ["Oportunidades", overview.totals.opportunities],
        ["Conversões", overview.totals.conversions],
        ["Valor confirmado", money.format(overview.totals.confirmedValue)],
      ] as const,
    [overview.totals],
  );

  if (!overview.projects.length) {
    return (
      <div className="animate-enter pb-10">
        <section className="relative overflow-hidden bg-[#07172f] p-7 text-white [clip-path:polygon(0_0,calc(100%_-_20px)_0,100%_20px,100%_100%,0_100%)] sm:p-12">
          <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
          <div className="dot-grid absolute inset-0 text-white/[.045]" />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-[#02e5cd]"><Sparkles size={15} /> Seu primeiro passo</span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-[-.05em] sm:text-5xl">Crie sua primeira Sobe.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">Conte sobre o seu negócio em linguagem simples. A Sobe propõe a estrutura, as perguntas e o próximo passo para você revisar.</p>
            <Link href="/app/onboarding" className="focus-ring mt-8 inline-flex min-h-12 items-center gap-2 bg-[#0054fc] px-5 text-sm font-extrabold text-white hover:bg-[#0186fc]">Criar minha Sobe <ArrowRight size={17} /></Link>
          </div>
        </section>
        <section className="mt-6 grid border border-[#cbd3dc] bg-white sm:grid-cols-3">
          {["Conte sobre seu negócio", "Confirme o que a Sobe entendeu", "Revise sua primeira versão"].map((label, index) => <div key={label} className={`p-5 ${index ? "border-t border-[#dfe5eb] sm:border-l sm:border-t-0" : ""}`}><span className="text-xs font-extrabold text-[#0054fc]">0{index + 1}</span><strong className="mt-2 block text-sm text-[#07172f]">{label}</strong></div>)}
        </section>
      </div>
    );
  }

  return (
    <div className="animate-enter pb-10">
      <header className="flex flex-col gap-5 border-b border-[#01d2df]/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-[-.045em] text-[#07172f] sm:text-4xl">
            {overview.hasPreviousVisit
              ? "Desde sua última visita"
              : "Últimos 7 dias"}
          </h1>
          <p className="mt-2 text-sm text-[#526171]">
            Acompanhe o que aconteceu e decida o próximo passo.
          </p>
        </div>
        <Link
          href={
            primary ? `/app/projects/${primary.id}/entries` : "/app/onboarding"
          }
          className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 bg-[#0054fc] px-5 text-sm font-extrabold text-white [clip-path:polygon(0_0,calc(100%_-_12px)_0,100%_12px,100%_100%,0_100%)] hover:bg-[#0186fc]"
        >
          <Plus size={17} /> {primary ? "Criar entrada" : "Criar estrutura"}
        </Link>
      </header>

      <section
        aria-label="Evidência do período"
        className="mt-6 grid border border-[#cbd3dc] bg-white sm:grid-cols-3 lg:grid-cols-6 [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,0_100%)]"
      >
        {metrics.map(([label, value], index) => (
          <div
            key={label}
            className={`min-h-28 px-5 py-5 ${index ? "border-t border-[#dfe5eb] sm:border-l sm:border-t-0" : ""}`}
          >
            <span className="block text-xs font-bold text-[#526171]">
              {label}
            </span>
            <strong className="mt-3 block text-2xl tabular-nums tracking-[-.03em] text-[#07172f]">
              {typeof value === "number" ? formatNumber(value) : value}
            </strong>
          </div>
        ))}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.02fr_.98fr]">
        <section className="relative min-h-[260px] overflow-hidden bg-[#07172f] p-7 text-white [clip-path:polygon(0_0,calc(100%_-_18px)_0,100%_18px,100%_100%,0_100%)] sm:p-9">
          <div className="sobe-gradient-rule absolute inset-x-0 top-0" />
          <div className="relative flex h-full flex-col justify-between gap-10 sm:flex-row sm:items-center">
            <span className="grid size-16 shrink-0 place-items-center border border-dashed border-white/55 text-[#02e5cd]">
              <Route size={27} />
            </span>
            <div className="flex-1">
              <p className="text-xs font-extrabold uppercase tracking-[.12em] text-[#01d2df]">
                Próxima melhor ação
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-[-.035em]">
                {nextAction.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                {nextAction.description}
              </p>
              <Link
                href={nextActionHref(nextAction.key, primary?.id)}
                className="focus-ring mt-6 inline-flex min-h-11 items-center gap-2 bg-[#0054fc] px-4 text-sm font-extrabold text-white hover:bg-[#0186fc]"
              >
                {nextAction.actionLabel}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section className="border border-[#cbd3dc] bg-white p-7 [clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_16px,100%_100%,0_100%)]">
          <div className="flex gap-3">
            <BrainCircuit className="mt-0.5 text-[#0054fc]" size={24} />
            <div>
              <h2 className="text-lg font-extrabold text-[#07172f]">
                Performance Copilot
              </h2>
              <p className="mt-1 text-sm text-[#526171]">
                {learning
                  ? "A Sobe ainda está aprendendo com seus dados"
                  : "A evidência mínima foi reunida"}
              </p>
            </div>
          </div>
          <div className="mt-7 space-y-5">
            {[
              [
                `${Math.min(overview.totals.sessions, 30)} de 30 sessões`,
                sessionsProgress,
              ],
              [`${Math.min(days, 30)} de 30 dias`, daysProgress],
            ].map(([label, progress]) => (
              <div key={String(label)}>
                <div className="flex justify-between gap-4 text-xs font-bold text-[#344150]">
                  <span>{label}</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-[#dfe5eb]">
                  <div
                    className="h-full bg-[#01d2df]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-7 border-t border-[#dfe5eb] pt-5">
            <p className="text-xs leading-5 text-[#526171]">
              Sugestões só aparecem quando houver evidência suficiente. A Sobe
              nunca publica mudanças automaticamente.
            </p>
            {primary ? (
              <Link
                href={`/app/projects/${primary.id}/analytics`}
                className="mt-3 inline-flex items-center gap-2 text-xs font-extrabold text-[#0054fc]"
              >
                Ver análise <ArrowRight size={14} />
              </Link>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-6 border border-[#cbd3dc] bg-white [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,0_100%)]">
        <div className="flex items-center justify-between border-b border-[#dfe5eb] px-5 py-4">
          <h2 className="font-extrabold text-[#07172f]">Seus negócios</h2>
          <Link
            href="/app/projects"
            className="text-xs font-extrabold text-[#0054fc]"
          >
            Ver todos
          </Link>
        </div>
        {overview.projects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-[#526171]">
                <tr className="border-b border-[#dfe5eb]">
                  <th className="px-5 py-3">Negócio</th>
                  <th>Status</th>
                  <th>Sessões</th>
                  <th>Conversões</th>
                  <th>Valor confirmado</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.projects.slice(0, 5).map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-[#edf0f3] last:border-0"
                  >
                    <td className="px-5 py-4">
                      <strong className="block text-[#07172f]">
                        {project.name}
                      </strong>
                      <span className="mt-1 block max-w-xs truncate text-xs text-[#526171]">
                        {project.publicUrl}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          project.status === "published"
                            ? "font-bold text-emerald-700"
                            : "font-bold text-[#667487]"
                        }
                      >
                        {project.status === "published"
                          ? "Publicado"
                          : "Rascunho"}
                      </span>
                    </td>
                    <td className="tabular-nums">
                      {formatNumber(project.sessions)}
                    </td>
                    <td className="tabular-nums">
                      {formatNumber(project.conversions)}
                    </td>
                    <td className="tabular-nums">
                      {money.format(project.confirmedValue)}
                    </td>
                    <td className="pr-5">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/app/projects/${project.id}`}
                          aria-label={`Abrir ${project.name}`}
                          className="focus-ring grid size-11 place-items-center border border-[#dfe5eb] text-[#0054fc]"
                        >
                          <ArrowRight size={16} />
                        </Link>
                        {project.status === "published" ? (
                          <a
                            href={project.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Visitar ${project.name}`}
                            className="focus-ring grid size-11 place-items-center border border-[#dfe5eb] text-[#344150]"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Globe2 className="mx-auto text-[#8fa1b8]" />
            <strong className="mt-4 block text-[#07172f]">
              Você ainda não tem negócios
            </strong>
            <p className="mt-2 text-sm text-[#526171]">
              Crie uma estrutura para começar a medir sua jornada.
            </p>
            <Link
              href="/app/onboarding"
              className="mt-4 inline-flex min-h-11 items-center gap-2 font-extrabold text-[#0054fc]"
            >
              Criar minha estrutura <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>

      <section className="mt-6 border border-[#cbd3dc] bg-white p-5 [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,0_100%)] sm:p-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="text-[#0054fc]" size={19} />
          <div>
            <h2 className="font-extrabold text-[#07172f]">Funil observado</h2>
            <p className="text-xs text-[#526171]">Sessões únicas no período</p>
          </div>
        </div>
        <div className="mt-6 grid border border-[#dfe5eb] sm:grid-cols-5">
          {[
            ["Atenção", overview.totals.sessions],
            ["Intenção", overview.totals.intentions],
            ["Ação", overview.totals.actions],
            ["Oportunidade", overview.totals.opportunities],
            ["Conversão", overview.totals.conversions],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`relative min-h-24 p-4 ${index ? "border-t border-[#dfe5eb] sm:border-l sm:border-t-0" : ""}`}
            >
              <span className="text-xs font-bold text-[#526171]">{label}</span>
              <strong className="mt-3 block text-xl tabular-nums text-[#07172f]">
                {formatNumber(Number(value))}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 border border-[#cbd3dc] bg-white p-6 [clip-path:polygon(0_0,calc(100%_-_14px)_0,100%_14px,100%_100%,0_100%)]">
        <div className="flex items-center gap-3">
          <Sparkles className="text-[#0054fc]" size={19} />
          <h2 className="font-extrabold text-[#07172f]">
            O que a Sobe aprendeu
          </h2>
        </div>
        {overview.learnings.length ? <div className="mt-5 grid gap-3">{overview.learnings.map((learning) => <article key={learning.id} className="border-l-2 border-[#01d2df] bg-[#f6f9fc] p-4"><strong className="text-sm leading-6 text-[#07172f]">{learning.statement}</strong><p className="mt-2 text-xs text-[#526171]">{learning.evidence}</p></article>)}</div> : <div className="py-9 text-center">
          <BrainCircuit className="mx-auto text-[#8fa1b8]" />
          <strong className="mt-4 block text-[#07172f]">
            Ainda não há aprendizado suficiente.
          </strong>
          <p className="mt-2 text-sm text-[#526171]">
            A Sobe precisa comparar versões publicadas com evidência real antes
            de registrar um fato.
          </p>
        </div>}
      </section>
    </div>
  );
}
