"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ServiceForm } from "@/components/commercial-data/services/service-form";
import { ServiceList } from "@/components/commercial-data/services/service-list";
import type { QuoteDefinition, RoutingDestination, SchedulableService, ServiceOffering } from "@/types";

function emptyService(projectId: string, order: number): ServiceOffering {
  return { id: crypto.randomUUID(), projectId, name: "", slug: "", serviceMode: "contact", priceMode: "on_request", currency: "BRL", isFeatured: false, isActive: true, order, settings: {} };
}

export function ServicesPanel({ projectId, services, destinations, quoteDefinition, schedulableServices, onChange }: { projectId: string; services: ServiceOffering[]; destinations: RoutingDestination[]; quoteDefinition?: QuoteDefinition; schedulableServices: SchedulableService[]; onChange: (services: ServiceOffering[]) => void }) {
  const [editing, setEditing] = useState<ServiceOffering | null>(null);
  function save() { if (!editing?.name.trim() || !editing.slug.trim()) return; onChange(services.some((item) => item.id === editing.id) ? services.map((item) => item.id === editing.id ? editing : item) : [...services, editing]); setEditing(null); }
  function move(service: ServiceOffering, direction: -1 | 1) { const ordered = services.toSorted((a, b) => a.order - b.order); const index = ordered.findIndex((item) => item.id === service.id); const target = index + direction; if (target < 0 || target >= ordered.length) return; [ordered[index], ordered[target]] = [ordered[target], ordered[index]]; onChange(ordered.map((item, order) => ({ ...item, order }))); }
  return <section><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Serviços</h2><p className="mt-1 text-sm text-[#74747e]">Apresentação, preço e próximo passo de cada oferta.</p></div><Button onClick={() => setEditing(emptyService(projectId, services.length))}><Plus data-icon="inline-start" />Novo serviço</Button></div><ServiceList services={services} onEdit={(service) => setEditing(service)} onDuplicate={(service) => setEditing({ ...service, id: crypto.randomUUID(), name: `${service.name} (cópia)`, slug: `${service.slug}-copia`, order: services.length })} onRemove={(service) => onChange(services.filter((item) => item.id !== service.id))} onMove={move} /><Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{services.some((item) => item.id === editing?.id) ? "Editar serviço" : "Novo serviço"}</DialogTitle><DialogDescription>Defina apenas informações confirmadas. Campos incompletos aparecerão na integridade dos dados.</DialogDescription></DialogHeader>{editing ? <ServiceForm value={editing} destinations={destinations} quoteDefinition={quoteDefinition} schedulableServices={schedulableServices} onChange={setEditing} /> : null}<DialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={save}>Salvar serviço</Button></DialogFooter></DialogContent></Dialog></section>;
}
