"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  PackageOpen,
  ReceiptText,
  RefreshCw,
  Warehouse,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commercialRepository,
  type CommercialOperation,
} from "@/lib/repositories/commercial-repository";
import { projectRepository } from "@/lib/repositories/project-repository";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/types";

const labels = {
  quote: "Orçamento",
  scheduling: "Agendamento",
  catalog_order: "Pedido",
  reservation: "Reserva",
} as const;
const icons = {
  quote: ReceiptText,
  scheduling: CalendarClock,
  catalog_order: PackageOpen,
  reservation: Warehouse,
} as const;
const statuses = {
  quote: [
    "submitted",
    "reviewing",
    "quoted",
    "accepted",
    "rejected",
    "cancelled",
  ],
  scheduling: [
    "pending",
    "confirmed",
    "cancel_requested",
    "cancelled",
    "completed",
    "no_show",
  ],
  catalog_order: ["submitted", "confirmed", "cancel_requested", "cancelled"],
  reservation: [
    "pending",
    "confirmed",
    "cancel_requested",
    "cancelled",
    "completed",
    "no_show",
  ],
};

export function CommercialOperations({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>();
  const [operations, setOperations] = useState<CommercialOperation[]>([]);
  const [kind, setKind] = useState<"all" | CommercialOperation["kind"]>("all");
  const [saving, setSaving] = useState("");
  const load = useCallback(async () => {
    const [found, requests] = await Promise.all([
      projectRepository.getProject(projectId),
      commercialRepository.getOperations(projectId),
    ]);
    setProject(found || null);
    setOperations(requests);
  }, [projectId]);
  useEffect(() => {
    void load().catch(() => setProject(null));
  }, [load]);
  const filtered = useMemo(
    () =>
      kind === "all"
        ? operations
        : operations.filter((item) => item.kind === kind),
    [kind, operations],
  );
  async function changeStatus(operation: CommercialOperation, status: string) {
    setSaving(operation.id);
    try {
      await commercialRepository.updateOperation(operation, status);
      setOperations((items) =>
        items.map((item) =>
          item.id === operation.id ? { ...item, status } : item,
        ),
      );
    } finally {
      setSaving("");
    }
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
          <p className="text-sm font-semibold text-[#0054fc]">{project.name}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-[-.04em]">
            Operação comercial
          </h1>
          <p className="mt-2 text-sm text-[#72727d]">
            Orçamentos, pedidos, agendas e reservas em um só lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedde5] bg-white px-4 text-sm font-bold"
        >
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(labels) as CommercialOperation["kind"][]).map((item) => {
          const Icon = icons[item];
          const count = operations.filter(
            (operation) => operation.kind === item,
          ).length;
          return (
            <button
              type="button"
              key={item}
              onClick={() =>
                setKind((current) => (current === item ? "all" : item))
              }
              className={`rounded-[19px] border bg-white p-5 text-left ${kind === item ? "border-[#0186fc] ring-4 ring-[#0186fc]/10" : "border-[#e4e3ea]"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#73737d]">
                  {labels[item]}
                </span>
                <Icon size={18} className="text-[#0054fc]" />
              </div>
              <strong className="mt-5 block text-3xl">{count}</strong>
            </button>
          );
        })}
      </div>
      <section className="mt-5 overflow-hidden rounded-[24px] border border-[#e4e3ea] bg-white">
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-[#e8e7ed] bg-[#f7fbff] text-[11px] font-bold uppercase tracking-wider text-[#85858f]">
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Contato</th>
                  <th className="px-5 py-3">Valor/data</th>
                  <th className="px-5 py-3">Recebido</th>
                  <th className="px-5 py-3">Status operacional</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((operation) => {
                  const Icon = icons[operation.kind];
                  return (
                    <tr
                      key={operation.id}
                      className="border-b border-[#eeedf2] last:border-0"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-sm font-bold">
                          <Icon size={16} className="text-[#0054fc]" />{" "}
                          {labels[operation.kind]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm">{operation.contact}</td>
                      <td className="px-5 py-4 text-xs text-[#666670]">
                        {operation.value !== undefined
                          ? new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(operation.value)
                          : operation.scheduledAt
                            ? formatDate(operation.scheduledAt)
                            : "—"}
                      </td>
                      <td className="px-5 py-4 text-xs text-[#777781]">
                        {formatDate(operation.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <select
                          aria-label={`Status de ${labels[operation.kind]}`}
                          disabled={saving === operation.id}
                          value={operation.status}
                          onChange={(event) =>
                            void changeStatus(operation, event.target.value)
                          }
                          className="min-h-9 rounded-full border border-[#dedde5] bg-[#f5f4f8] px-3 text-xs font-bold"
                        >
                          {statuses[operation.kind].map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center">
            <div>
              <PackageOpen className="mx-auto text-[#0054fc]" />
              <h2 className="mt-4 font-extrabold">Nenhuma solicitação ainda</h2>
              <p className="mt-2 text-sm text-[#7b7b85]">
                As conversões concluídas aparecem aqui com status atualizável.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
