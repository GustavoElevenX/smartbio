"use client";

import { ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ServiceOffering } from "@/types";

export function ServiceList({ services, onEdit, onDuplicate, onRemove, onMove }: { services: ServiceOffering[]; onEdit: (service: ServiceOffering) => void; onDuplicate: (service: ServiceOffering) => void; onRemove: (service: ServiceOffering) => void; onMove: (service: ServiceOffering, direction: -1 | 1) => void }) {
  if (!services.length) return <div className="rounded-[18px] border border-dashed border-[#d8d6e2] p-10 text-center text-sm text-[#74747e]">Nenhum serviço cadastrado. Crie o primeiro usando dados reais do negócio.</div>;
  return <div className="flex flex-col gap-3">{services.toSorted((a, b) => a.order - b.order).map((service) => <div key={service.id} className="flex flex-wrap items-center gap-3 rounded-[18px] border border-[#e3e2e9] bg-white p-4"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-sm">{service.name}</strong><Badge variant={service.isActive ? "secondary" : "outline"}>{service.isActive ? "Ativo" : "Inativo"}</Badge></div><p className="mt-1 text-xs text-[#777781]">{service.priceMode === "on_request" ? "Sob consulta" : service.priceMode === "free" ? "Grátis" : service.price != null ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: service.currency }).format(service.price) : "Preço pendente"}</p></div><Button size="icon" variant="ghost" title="Mover para cima" onClick={() => onMove(service, -1)}><ArrowUp /></Button><Button size="icon" variant="ghost" title="Mover para baixo" onClick={() => onMove(service, 1)}><ArrowDown /></Button><Button size="icon" variant="ghost" title="Editar" onClick={() => onEdit(service)}><Pencil /></Button><Button size="icon" variant="ghost" title="Duplicar" onClick={() => onDuplicate(service)}><Copy /></Button><Button size="icon" variant="ghost" title="Excluir" onClick={() => onRemove(service)}><Trash2 /></Button></div>)}</div>;
}
