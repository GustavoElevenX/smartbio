"use client";

import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { MediaPicker } from "@/components/media-library/media-picker";
import type { QuoteDefinition, RoutingDestination, SchedulableService, ServiceOffering } from "@/types";

export function ServiceForm({ value, destinations, quoteDefinition, schedulableServices, onChange }: { value: ServiceOffering; destinations: RoutingDestination[]; quoteDefinition?: QuoteDefinition; schedulableServices: SchedulableService[]; onChange: (value: ServiceOffering) => void }) {
  const patch = (next: Partial<ServiceOffering>) => onChange({ ...value, ...next });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div><Label htmlFor="service-name">Nome</Label><Input id="service-name" value={value.name} onChange={(event) => patch({ name: event.target.value })} /></div>
      <div><Label htmlFor="service-slug">Identificador</Label><Input id="service-slug" value={value.slug} onChange={(event) => patch({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") })} /></div>
      <div className="sm:col-span-2"><Label htmlFor="service-description">Descrição</Label><Textarea id="service-description" value={value.description || ""} onChange={(event) => patch({ description: event.target.value })} /></div>
      <div><Label htmlFor="service-mode">Modo de venda</Label><Select id="service-mode" value={value.serviceMode} onChange={(event) => patch({ serviceMode: event.target.value as ServiceOffering["serviceMode"] })}><option value="contact">Contato</option><option value="quote">Orçamento</option><option value="schedule">Agendamento</option><option value="external_checkout">Checkout externo</option><option value="external_url">URL externa</option></Select></div>
      <div><Label htmlFor="price-mode">Preço</Label><Select id="price-mode" value={value.priceMode} onChange={(event) => patch({ priceMode: event.target.value as ServiceOffering["priceMode"] })}><option value="on_request">Sob consulta</option><option value="fixed">Fixo</option><option value="starting_at">A partir de</option><option value="range">Faixa</option><option value="free">Grátis</option></Select></div>
      {value.priceMode === "fixed" || value.priceMode === "starting_at" ? <div><Label htmlFor="service-price">Valor</Label><Input id="service-price" type="number" min="0" step="0.01" value={value.price ?? ""} onChange={(event) => patch({ price: event.target.value ? Number(event.target.value) : undefined })} /></div> : null}
      {value.priceMode === "range" ? <><div><Label htmlFor="service-min">Mínimo</Label><Input id="service-min" type="number" min="0" step="0.01" value={value.minPrice ?? ""} onChange={(event) => patch({ minPrice: event.target.value ? Number(event.target.value) : undefined })} /></div><div><Label htmlFor="service-max">Máximo</Label><Input id="service-max" type="number" min="0" step="0.01" value={value.maxPrice ?? ""} onChange={(event) => patch({ maxPrice: event.target.value ? Number(event.target.value) : undefined })} /></div></> : null}
      <div><Label htmlFor="service-destination">Destino</Label><Select id="service-destination" value={value.destinationId || ""} onChange={(event) => patch({ destinationId: event.target.value || undefined })}><option value="">Definir depois</option>{destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.label}</option>)}</Select></div>
      <div><Label htmlFor="service-quote">Orçamento associado</Label><Select id="service-quote" value={String(value.settings.quoteDefinitionId || "")} onChange={(event) => patch({ settings: { ...value.settings, quoteDefinitionId: event.target.value || undefined } })}><option value="">Sem orçamento</option>{quoteDefinition ? <option value={quoteDefinition.id}>{quoteDefinition.title}</option> : null}</Select></div>
      <div><Label htmlFor="service-schedule">Agenda associada</Label><Select id="service-schedule" value={String(value.settings.schedulableServiceId || "")} onChange={(event) => patch({ settings: { ...value.settings, schedulableServiceId: event.target.value || undefined } })}><option value="">Sem agenda</option>{schedulableServices.map((service) => <option key={service.id} value={service.id}>{service.name || "Serviço sem nome"}</option>)}</Select></div>
      <div><Label htmlFor="service-external-url">URL externa</Label><Input id="service-external-url" type="url" value={value.externalUrl || ""} onChange={(event) => patch({ externalUrl: event.target.value || undefined })} /></div>
      <div><Label>Imagem</Label><MediaPicker projectId={value.projectId} value={value.imageAssetId} onChange={(imageAssetId) => patch({ imageAssetId })} /></div>
      <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={value.isActive} onCheckedChange={(checked) => patch({ isActive: checked })} />Serviço ativo</label>
      <label className="flex items-center gap-3 text-sm font-semibold"><Switch checked={value.isFeatured} onCheckedChange={(checked) => patch({ isFeatured: checked })} />Destacar na experiência</label>
    </div>
  );
}
