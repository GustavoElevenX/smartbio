"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { backfillConversionGoals } from "@/features/conversion-goals/utils";
import { localStore } from "@/lib/local-store";
import { projectRepository } from "@/lib/repositories/project-repository";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { transitionOpportunity } from "@/server/opportunities/status";
import type {
  CommercialOpportunity,
  OpportunityStatus,
  Project,
} from "@/types";
import { ConversionDialog } from "./conversion-dialog";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityDetails } from "./opportunity-details";
import { OpportunityFilters } from "./opportunity-filters";

function rowToOpportunity(
  row: Record<string, unknown>,
): CommercialOpportunity {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: String(row.project_id),
    sessionId: row.session_id ? String(row.session_id) : undefined,
    conversionGoalId: row.conversion_goal_id
      ? String(row.conversion_goal_id)
      : undefined,
    entryPointId: row.entry_point_id
      ? String(row.entry_point_id)
      : undefined,
    destinationId: row.destination_id
      ? String(row.destination_id)
      : undefined,
    sourceType: row.source_type as CommercialOpportunity["sourceType"],
    sourceId: String(row.source_id),
    status: row.status as OpportunityStatus,
    title: String(row.title),
    contactName: row.contact_name ? String(row.contact_name) : undefined,
    contactEmail: row.contact_email ? String(row.contact_email) : undefined,
    contactPhone: row.contact_phone ? String(row.contact_phone) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    estimatedValue:
      row.estimated_value == null ? undefined : Number(row.estimated_value),
    confirmedValue:
      row.confirmed_value == null ? undefined : Number(row.confirmed_value),
    currency: String(row.currency || "BRL"),
    attribution: row.attribution as CommercialOpportunity["attribution"],
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function OpportunitiesPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [items, setItems] = useState<CommercialOpportunity[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<"all" | OpportunityStatus>("all");
  const [query, setQuery] = useState("");
  const [conversionOpen, setConversionOpen] = useState(false);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingItems(true);
      setLoadError("");

      let found: Project | undefined;
      try {
        found = await projectRepository.getProject(projectId);
      } catch {
        if (active) setProject(null);
        return;
      }

      if (!active) return;
      setProject(found || null);
      if (!found) return;

      try {
        let captured: CommercialOpportunity[];
        if (!isSupabaseConfigured()) {
          captured = localStore.getOpportunities(projectId);
        } else {
          const response = await fetch(
            `/api/projects/${projectId}/opportunities`,
          );
          if (!response.ok) {
            throw new Error("Não foi possível carregar as oportunidades.");
          }
          const payload = (await response.json()) as {
            data?: Record<string, unknown>[];
          };
          captured = (payload.data || []).map(rowToOpportunity);
        }

        if (!active) return;
        setItems(captured);
        setSelectedId((current) =>
          current && captured.some((item) => item.id === current)
            ? current
            : captured[0]?.id,
        );
      } catch {
        if (active) {
          setLoadError(
            "Não foi possível carregar os contatos. Tente novamente.",
          );
        }
      } finally {
        if (active) setLoadingItems(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;
      const searchable = [
        item.title,
        item.contactName,
        item.contactEmail,
        item.contactPhone,
        item.summary,
        item.attribution?.source,
        item.attribution?.campaign,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && searchable.includes(normalizedQuery);
    });
  }, [filter, items, query]);

  const selected =
    filtered.find((item) => item.id === selectedId) || filtered[0];
  const goals = project ? backfillConversionGoals(project) : [];

  if (project === undefined) {
    return (
      <div
        className="h-80 animate-pulse rounded-3xl bg-white"
        aria-label="Carregando negócio"
      />
    );
  }

  if (!project) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center">
        Negócio não encontrado.
      </div>
    );
  }

  const resolvedProject = project;

  async function update(
    status: OpportunityStatus,
    input: { confirmedValue?: number; lossReason?: string } = {},
  ) {
    if (!selected) return;
    const updated = transitionOpportunity(selected, status, input);
    setItems((current) =>
      current.map((item) => (item.id === selected.id ? updated : item)),
    );

    if (!isSupabaseConfigured()) {
      localStore.updateOpportunity(selected.id, updated);
      if (status === "converted" || status === "lost") {
        localStore.track({
          projectId: resolvedProject.id,
          visitorId: "operator",
          sessionId: selected.sessionId || selected.id,
          eventName:
            status === "converted"
              ? "conversion_confirmed"
              : "conversion_lost",
          conversionGoalId: selected.conversionGoalId,
          entryPointId: selected.entryPointId,
          destinationId: selected.destinationId,
          metadata: input,
        });
      }
      return;
    }

    await fetch(`/api/projects/${resolvedProject.id}/opportunities`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: selected.id, status, ...input }),
    });
  }

  const counts = {
    new: items.filter((item) => item.status === "new").length,
    progress: items.filter((item) => item.status === "in_progress").length,
    converted: items.filter((item) => item.status === "converted").length,
  };

  return (
    <div className="animate-enter">
      <header>
        <Link
          href={`/app/projects/${project.id}`}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold text-[#65626d]"
        >
          <ArrowLeft size={14} aria-hidden="true" /> {project.name}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eaf3ff] text-[#0054fc]">
            <BriefcaseBusiness aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold tracking-[-.04em]">
              Oportunidades
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#65626d]">
              Veja quem entrou em contato, o interesse demonstrado e a etapa de
              cada atendimento.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          ["Novas", counts.new, BriefcaseBusiness],
          ["Em andamento", counts.progress, Clock3],
          ["Convertidas", counts.converted, CheckCircle2],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof BriefcaseBusiness;
          return (
            <div
              key={String(label)}
              className="rounded-2xl border border-[#e3e1e8] bg-white p-4"
            >
              <StatIcon
                size={17}
                className="text-[#0054fc]"
                aria-hidden="true"
              />
              <strong className="mt-5 block text-2xl tabular-nums">
                {Number(value)}
              </strong>
              <span className="text-xs text-[#65626d]">{String(label)}</span>
            </div>
          );
        })}
      </div>

      <section className="mt-5 grid gap-5 xl:grid-cols-[.76fr_1.24fr]">
        <div>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-[220px] flex-1">
              <Search
                className="absolute left-3 top-3.5 text-[#65626d]"
                size={15}
                aria-hidden="true"
              />
              <input
                aria-label="Buscar oportunidades"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar nome, telefone, e-mail ou interesse"
                className="focus-ring min-h-11 w-full rounded-xl border border-[#dedce5] bg-white pl-9 pr-3 text-xs"
              />
            </label>
            <OpportunityFilters value={filter} onChange={setFilter} />
          </div>

          {loadError ? (
            <div
              role="alert"
              className="mt-3 rounded-2xl border border-[#f0c4c4] bg-[#fff5f5] p-5"
            >
              <strong className="text-sm text-[#942f2f]">{loadError}</strong>
              <Button
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={() => setReloadKey((current) => current + 1)}
              >
                Tentar novamente
              </Button>
            </div>
          ) : loadingItems ? (
            <div className="mt-3 grid gap-3" aria-label="Carregando contatos">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-2xl bg-white"
                />
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              {filtered.length ? (
                filtered.map((item) => (
                  <OpportunityCard
                    key={item.id}
                    opportunity={item}
                    selected={item.id === selected?.id}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d9d6e1] p-10 text-center">
                  <strong>
                    {items.length
                      ? "Nenhuma oportunidade neste filtro"
                      : "Nenhum contato recebido ainda"}
                  </strong>
                  <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#65626d]">
                    {items.length
                      ? "Altere a busca ou o status para encontrar outro contato."
                      : "Formulários, pedidos, agendamentos e contatos encaminhados passam a aparecer aqui."}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-3xl border border-[#e2e0e8] bg-white p-5 sm:p-6">
          {selected ? (
            <>
              <OpportunityDetails
                opportunity={{ ...selected, projectName: project.name }}
                goal={goals.find(
                  (goal) => goal.id === selected.conversionGoalId,
                )}
                entry={project.entryPoints?.find(
                  (entry) => entry.id === selected.entryPointId,
                )}
              />
              <div className="mt-7 flex flex-wrap gap-2">
                {selected.status === "new" ? (
                  <Button
                    variant="secondary"
                    onClick={() => void update("in_progress")}
                  >
                    Iniciar atendimento
                  </Button>
                ) : null}
                {!(["converted", "archived"] as OpportunityStatus[]).includes(
                  selected.status,
                ) ? (
                  <Button onClick={() => setConversionOpen(true)}>
                    <CheckCircle2 aria-hidden="true" /> Confirmar conversão
                  </Button>
                ) : null}
                {!(
                  ["lost", "converted", "archived"] as OpportunityStatus[]
                ).includes(selected.status) ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const reason = window.prompt(
                        "Por que esta oportunidade foi perdida?",
                      );
                      if (reason) void update("lost", { lossReason: reason });
                    }}
                  >
                    <XCircle aria-hidden="true" /> Marcar como perdida
                  </Button>
                ) : null}
              </div>
              <ConversionDialog
                open={conversionOpen}
                onOpenChange={setConversionOpen}
                onConfirm={(value) => {
                  void update("converted", { confirmedValue: value });
                  setConversionOpen(false);
                }}
              />
            </>
          ) : (
            <div className="grid min-h-64 place-items-center text-center text-sm text-[#65626d]">
              {loadingItems
                ? "Carregando detalhes…"
                : "Selecione uma oportunidade para ver o contato e o contexto."}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
