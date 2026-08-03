"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Clipboard,
  Download,
  ExternalLink,
  Filter,
  MessageCircle,
  Search,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import { commercialRepository } from "@/lib/repositories/commercial-repository";
import { projectRepository } from "@/lib/repositories/project-repository";
import { downloadCsv, formatDate } from "@/lib/utils";
import type { Lead, Project } from "@/types";

const statusLabel = {
  new: "Novo",
  contacted: "Em atendimento",
  qualified: "Qualificado",
  converted: "Convertido",
  lost: "Perdido",
};
const statusStyle = {
  new: "bg-[#e8edff] text-[#425fbd]",
  contacted: "bg-[#fff4dc] text-[#9a6a10]",
  qualified: "bg-[#eeeaff] text-[#604bc5]",
  converted: "bg-[#e7f7ef] text-[#147b58]",
  lost: "bg-[#f0eff3] text-[#72727b]",
};

export function LeadsDashboard({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [note, setNote] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      projectRepository.getProject(projectId),
      commercialRepository.getLeads(projectId),
    ])
      .then(([found, captured]) => {
        if (!active) return;
        setProject(found || null);
        setLeads(captured);
      })
      .catch(() => {
        if (active) setProject(null);
      });
    return () => {
      active = false;
    };
  }, [projectId]);
  const filtered = useMemo(
    () =>
      leads.filter(
        (lead) =>
          (status === "all" || lead.status === status) &&
          `${lead.name} ${lead.email} ${lead.phone} ${lead.company}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [leads, query, status],
  );
  function changeStatus(lead: Lead, value: Lead["status"]) {
    void commercialRepository.updateLead(lead.id, { status: value });
    const next = leads.map((item) =>
      item.id === lead.id ? { ...item, status: value } : item,
    );
    setLeads(next);
    setSelected((current) =>
      current?.id === lead.id ? { ...current, status: value } : current,
    );
  }
  function saveNote() {
    if (!selected) return;
    void commercialRepository.updateLead(selected.id, { notes: note });
    setLeads((items) =>
      items.map((item) =>
        item.id === selected.id ? { ...item, notes: note } : item,
      ),
    );
    setSelected({ ...selected, notes: note });
  }
  if (project === undefined)
    return <div className="h-96 animate-pulse rounded-[24px] bg-white" />;
  if (!project)
    return (
      <div className="rounded-[24px] bg-white p-10 text-center">
        <h1 className="font-extrabold">Projeto não encontrado</h1>
      </div>
    );
  return (
    <div className="animate-enter">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/app/projects"
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#6f6f79]"
          >
            <ArrowLeft size={14} /> Projetos
          </Link>
          <p className="text-sm font-semibold text-[#6d5ef5]">{project.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            Leads capturados
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            Contexto e respostas de cada oportunidade.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(`leads-${project.slug}.csv`, [
              [
                "nome",
                "email",
                "telefone",
                "empresa",
                "origem",
                "status",
                "recomendacao",
                "respostas",
                "data",
              ],
              ...filtered.map((lead) => [
                lead.name,
                lead.email,
                lead.phone,
                lead.company,
                lead.source,
                statusLabel[lead.status],
                lead.recommendation,
                JSON.stringify(lead.answers),
                lead.createdAt,
              ]),
            ])
          }
        >
          <Download size={16} /> Exportar CSV
        </Button>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(
          [
            "new",
            "contacted",
            "qualified",
            "converted",
            "lost",
          ] as Lead["status"][]
        ).map((item) => (
          <button
            key={item}
            onClick={() => setStatus(status === item ? "all" : item)}
            className={`rounded-[17px] border bg-white p-4 text-left transition ${status === item ? "border-[#7669e6] ring-4 ring-[#7669e6]/10" : "border-[#e4e3ea]"}`}
          >
            <span className="text-xs font-semibold text-[#777781]">
              {statusLabel[item]}
            </span>
            <strong className="mt-3 block text-2xl">
              {leads.filter((lead) => lead.status === item).length}
            </strong>
          </button>
        ))}
      </div>
      <section className="mt-5 overflow-hidden rounded-[24px] border border-[#e4e3ea] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#e8e7ed] p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#85858f]"
            />
            <Input
              aria-label="Buscar leads"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, contato ou empresa"
              className="pl-10"
            />
          </div>
          <button className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#dedde5] px-4 text-sm font-bold text-[#666670]">
            <Filter size={16} />{" "}
            {status === "all"
              ? "Todos os status"
              : statusLabel[status as Lead["status"]]}
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eeecff] text-[#6558db]">
                <Users />
              </span>
              <h2 className="mt-4 font-extrabold">Nenhum lead encontrado</h2>
              <p className="mt-2 text-sm text-[#7b7b85]">
                Ajuste os filtros ou compartilhe sua experiência.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-[#e8e7ed] bg-[#fafafd] text-[11px] font-bold uppercase tracking-wider text-[#85858f]">
                  <th className="px-5 py-3">Lead</th>
                  <th className="px-5 py-3">Interesse</th>
                  <th className="px-5 py-3">Origem</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-[#eeedf2] last:border-0 hover:bg-[#fbfbfd]"
                  >
                    <td className="px-5 py-4">
                      <strong className="block text-sm">
                        {lead.name || "Lead sem nome"}
                      </strong>
                      <span className="mt-1 block text-xs text-[#7b7b85]">
                        {lead.email || lead.phone || "Sem contato"}
                        {lead.company && ` · ${lead.company}`}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-semibold text-[#5f5f69]">
                      {lead.recommendation ||
                        Object.values(lead.answers)[0] ||
                        "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-[#f0eff4] px-2.5 py-1 text-[11px] font-bold capitalize">
                        {lead.source || "direto"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        aria-label={`Status de ${lead.name}`}
                        value={lead.status}
                        onChange={(event) =>
                          changeStatus(
                            lead,
                            event.target.value as Lead["status"],
                          )
                        }
                        className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-bold ${statusStyle[lead.status]}`}
                      >
                        {(Object.keys(statusLabel) as Lead["status"][]).map(
                          (item) => (
                            <option key={item} value={item}>
                              {statusLabel[item]}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-xs text-[#777781]">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => {
                          setSelected(lead);
                          setNote(lead.notes || "");
                        }}
                        className="focus-ring rounded-xl border border-[#dedde5] px-3 py-2 text-xs font-bold"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <div
          className="fixed inset-0 z-[70] bg-black/25"
          onClick={() => setSelected(null)}
        >
          <aside
            className="absolute inset-y-0 right-0 w-full max-w-[480px] overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle[selected.status]}`}
                >
                  {statusLabel[selected.status]}
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-.035em]">
                  {selected.name || "Lead sem nome"}
                </h2>
                <p className="mt-1 text-sm text-[#777781]">
                  {selected.company}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="focus-ring grid size-10 place-items-center rounded-xl bg-[#f0eff4]"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {[
                ["E-mail", selected.email],
                ["Telefone", selected.phone],
                ["Origem", selected.source],
                ["Campanha", selected.campaign],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[15px] bg-[#f5f4f8] p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#85858f]">
                    {label}
                  </span>
                  <strong className="mt-1 block truncate text-xs">
                    {value || "—"}
                  </strong>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              {selected.phone && (
                <>
                  <button
                    onClick={() =>
                      void navigator.clipboard.writeText(selected.phone || "")
                    }
                    className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#dedde5] text-xs font-bold"
                  >
                    <Clipboard size={15} /> Copiar telefone
                  </button>
                  <a
                    href={`https://wa.me/${selected.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#15966c] text-xs font-bold text-white"
                  >
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                </>
              )}
            </div>
            {selected.commercialAction ? (
              <div className="mt-7 rounded-[18px] border border-[#dcd8ff] bg-[#f0eeff] p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6558db]">
                  Contexto comercial
                </span>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[#777781]">Ação</span>
                    <strong className="mt-1 block capitalize">
                      {selected.commercialAction.replaceAll("_", " ")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#777781]">Status</span>
                    <strong className="mt-1 block">
                      {selected.operationalStatus || "recebido"}
                    </strong>
                  </div>
                  {selected.score !== undefined ? (
                    <div>
                      <span className="text-[#777781]">Pontuação</span>
                      <strong className="mt-1 block">
                        {selected.score} · {selected.qualificationBand}
                      </strong>
                    </div>
                  ) : null}
                  {selected.estimatedValue !== undefined ? (
                    <div>
                      <span className="text-[#777781]">Valor estimado</span>
                      <strong className="mt-1 block">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(selected.estimatedValue)}
                      </strong>
                    </div>
                  ) : null}
                  {selected.scheduledAt ? (
                    <div className="col-span-2">
                      <span className="text-[#777781]">Data agendada</span>
                      <strong className="mt-1 block">
                        {formatDate(selected.scheduledAt)}
                      </strong>
                    </div>
                  ) : null}
                </div>
                {selected.qualificationReason ? (
                  <p className="mt-4 text-xs leading-5 text-[#625d78]">
                    {selected.qualificationReason}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-7">
              <h3 className="font-extrabold">Respostas da jornada</h3>
              <div className="mt-3 space-y-2">
                {Object.entries(selected.answers).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-[15px] border border-[#e4e3ea] p-4"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#85858f]">
                      {key.replaceAll("_", " ")}
                    </span>
                    <strong className="mt-1 block text-sm">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
            {selected.recommendation && (
              <div className="mt-6 rounded-[18px] border border-[#dcd8ff] bg-[#f0eeff] p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6558db]">
                  Recomendação recebida
                </span>
                <strong className="mt-2 block text-lg">
                  {selected.recommendation}
                </strong>
              </div>
            )}
            <div className="mt-7">
              <Label htmlFor="note">Observações</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Adicione contexto para o time…"
              />
              <Button onClick={saveNote} className="mt-3 w-full">
                Salvar observação
              </Button>
            </div>
            <div className="mt-7 rounded-[18px] bg-[#f5f4f8] p-5">
              <h3 className="text-sm font-extrabold">Linha da jornada</h3>
              <div className="mt-4 space-y-3">
                {(selected.timeline?.length
                  ? selected.timeline
                  : [
                      {
                        label: "Acessou a experiência",
                        at: selected.createdAt,
                      },
                      { label: "Respondeu à jornada", at: selected.createdAt },
                      {
                        label: selected.operationalStatus || "Lead capturado",
                        at: selected.createdAt,
                      },
                    ]
                ).map((item, index) => (
                  <div
                    key={`${item.label}-${index}`}
                    className="flex items-center gap-3 text-xs"
                  >
                    <span className="grid size-6 place-items-center rounded-full bg-[#6d5ef5] text-white">
                      <span className="size-1.5 rounded-full bg-white" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    <small className="text-[#898993]">
                      {new Date(item.at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                ))}
              </div>
            </div>
            <a
              href={`/${project.slug}`}
              target="_blank"
              className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-[#6255d8]"
            >
              Abrir experiência <ExternalLink size={14} />
            </a>
          </aside>
        </div>
      )}
    </div>
  );
}
