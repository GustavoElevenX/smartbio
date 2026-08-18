"use client";

import {
  CalendarClock,
  ChevronDown,
  MapPinned,
  PackageOpen,
  ReceiptText,
  Route,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { capabilityRegistry } from "@/features/capabilities/capability-registry";
import { uid } from "@/lib/utils";
import type { CapabilityKey, Project, ProjectCapability } from "@/types";

const icons: Record<CapabilityKey, typeof SlidersHorizontal> = {
  qualification: SlidersHorizontal,
  quote: ReceiptText,
  scheduling: CalendarClock,
  catalog_order: PackageOpen,
  reservation: MapPinned,
  routing: Route,
  payment: ReceiptText,
};

export function CapabilityPanel({
  project,
  onChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
}) {
  const [open, setOpen] = useState<CapabilityKey | null>(null);
  const capabilities = project.capabilities || [];
  function updateCapability(
    key: CapabilityKey,
    patch: Partial<ProjectCapability>,
  ) {
    const existing = capabilities.find((item) => item.key === key);
    const next = existing
      ? capabilities.map((item) =>
          item.key === key
            ? { ...item, ...patch, source: "user" as const }
            : item,
        )
      : [
          ...capabilities,
          {
            key,
            enabled: Boolean(patch.enabled),
            source: "user" as const,
            version: 1,
            configuration: capabilityRegistry[key].defaultConfiguration,
            ...patch,
          },
        ];
    onChange({
      ...project,
      capabilities: next,
      updatedAt: new Date().toISOString(),
    });
  }
  function updateConfig(
    patch: Partial<NonNullable<Project["commercialConfig"]>>,
  ) {
    onChange({
      ...project,
      commercialConfig: { ...project.commercialConfig, ...patch },
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mb-6 rounded-[18px] border border-[#dedde6] bg-[#f7fbff] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-[#eaf3ff] text-[#0054fc]">
          <SlidersHorizontal size={17} />
        </span>
        <span>
          <strong className="block text-sm">
            Como esta experiência converte
          </strong>
          <small className="mt-1 block leading-4 text-[#777781]">
            Ative e configure os caminhos que o visitante pode concluir.
          </small>
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {(Object.keys(capabilityRegistry) as CapabilityKey[]).map((key) => {
          const definition = capabilityRegistry[key];
          const current = capabilities.find((item) => item.key === key);
          const Icon = icons[key];
          return (
            <div
              key={key}
              className="rounded-xl border border-[#e4e3ea] bg-white"
            >
              <div className="flex items-center gap-2 p-3">
                <Icon size={16} className="text-[#0054fc]" />
                <span className="min-w-0 flex-1">
                  <strong className="block text-xs">{definition.label}</strong>
                  {!definition.enabledByFeature ? (
                    <small className="text-[10px] text-[#9a6c28]">
                      Disponível por feature flag
                    </small>
                  ) : null}
                </span>
                <label className="inline-flex items-center gap-2 text-[10px] font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(current?.enabled)}
                    disabled={!definition.enabledByFeature}
                    onChange={(event) =>
                      updateCapability(key, { enabled: event.target.checked })
                    }
                    className="accent-[#0054fc]"
                  />{" "}
                  Ativa
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setOpen((value) => (value === key ? null : key))
                  }
                  className="grid size-8 place-items-center rounded-lg hover:bg-[#f0eff4]"
                  aria-label={`Configurar ${definition.label}`}
                >
                  <ChevronDown
                    size={14}
                    className={open === key ? "rotate-180" : ""}
                  />
                </button>
              </div>
              {open === key ? (
                <div className="border-t border-[#ebeaf0] p-3">
                  {key === "quote" ? (
                    <QuoteSettings project={project} update={updateConfig} />
                  ) : null}
                  {key === "scheduling" ? (
                    <ScheduleSettings project={project} update={updateConfig} />
                  ) : null}
                  {key === "catalog_order" ? (
                    <CatalogSettings project={project} update={updateConfig} />
                  ) : null}
                  {key === "reservation" ? (
                    <ReservationSettings
                      project={project}
                      update={updateConfig}
                    />
                  ) : null}
                  {key === "routing" ? (
                    <RoutingSettings project={project} update={updateConfig} />
                  ) : null}
                  {key === "qualification" ? (
                    <p className="text-xs leading-5 text-[#74747e]">
                      A pontuação usa as regras cadastradas na jornada. Faixas
                      padrão: frio até 19, potencial até 49 e qualificado a
                      partir de 50.
                    </p>
                  ) : null}
                  {key === "payment" ? (
                    <div>
                      <Label htmlFor="payment-url">
                        Link de pagamento externo
                      </Label>
                      <Input
                        id="payment-url"
                        type="url"
                        value={project.commercialConfig?.paymentUrl || ""}
                        onChange={(event) =>
                          updateConfig({ paymentUrl: event.target.value })
                        }
                        placeholder="https://checkout..."
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuoteSettings({
  project,
  update,
}: {
  project: Project;
  update: (patch: Partial<NonNullable<Project["commercialConfig"]>>) => void;
}) {
  const definition = project.commercialConfig?.quoteDefinition;
  if (!definition)
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() =>
          update({
            quoteDefinition: {
              id: uid("quote"),
              projectId: project.id,
              title: "Solicite seu orçamento",
              currency: "BRL",
              baseAmount: 0,
              estimationMode: "range",
              questions: [],
              rules: [],
              completionChannel: "native",
              isActive: true,
            },
          })
        }
      >
        Criar configuração de orçamento
      </Button>
    );
  return (
    <div className="grid gap-3">
      <div>
        <Label htmlFor="quote-title">Título</Label>
        <Input
          id="quote-title"
          value={definition.title}
          onChange={(event) =>
            update({
              quoteDefinition: { ...definition, title: event.target.value },
            })
          }
        />
      </div>
      <div>
        <Label htmlFor="base-amount">Valor inicial</Label>
        <Input
          id="base-amount"
          type="number"
          min="0"
          value={definition.baseAmount || 0}
          onChange={(event) =>
            update({
              quoteDefinition: {
                ...definition,
                baseAmount: Number(event.target.value),
              },
            })
          }
        />
      </div>
    </div>
  );
}

function ScheduleSettings({
  project,
  update,
}: {
  project: Project;
  update: (patch: Partial<NonNullable<Project["commercialConfig"]>>) => void;
}) {
  const services = project.commercialConfig?.schedulableServices || [];
  return (
    <div>
      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.id} className="grid grid-cols-[1fr_80px] gap-2">
            <Input
              aria-label="Nome do serviço"
              value={service.name}
              onChange={(event) =>
                update({
                  schedulableServices: services.map((item) =>
                    item.id === service.id
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                })
              }
            />
            <Input
              aria-label="Duração em minutos"
              type="number"
              value={service.durationMinutes}
              onChange={(event) =>
                update({
                  schedulableServices: services.map((item) =>
                    item.id === service.id
                      ? { ...item, durationMinutes: Number(event.target.value) }
                      : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        onClick={() =>
          update({
            schedulableServices: [
              ...services,
              {
                id: uid("service"),
                projectId: project.id,
                name: "Novo atendimento",
                durationMinutes: 60,
                bufferBeforeMinutes: 0,
                bufferAfterMinutes: 0,
                capacity: 1,
                confirmationMode: "manual_approval",
                isActive: true,
              },
            ],
          })
        }
      >
        Adicionar serviço
      </Button>
    </div>
  );
}

function CatalogSettings({
  project,
  update,
}: {
  project: Project;
  update: (patch: Partial<NonNullable<Project["commercialConfig"]>>) => void;
}) {
  const items = project.commercialConfig?.catalogItems || [];
  return (
    <div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_90px] gap-2">
            <Input
              aria-label="Nome do item"
              value={item.name}
              onChange={(event) =>
                update({
                  catalogItems: items.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, name: event.target.value }
                      : candidate,
                  ),
                })
              }
            />
            <Input
              aria-label="Preço do item"
              type="number"
              value={item.price || 0}
              onChange={(event) =>
                update({
                  catalogItems: items.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, price: Number(event.target.value) }
                      : candidate,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        onClick={() =>
          update({
            catalogItems: [
              ...items,
              {
                id: uid("item"),
                projectId: project.id,
                name: "Novo item",
                price: 0,
                currency: "BRL",
                isAvailable: true,
                variants: [],
                metadata: {},
              },
            ],
          })
        }
      >
        Adicionar item
      </Button>
    </div>
  );
}

function ReservationSettings({
  project,
  update,
}: {
  project: Project;
  update: (patch: Partial<NonNullable<Project["commercialConfig"]>>) => void;
}) {
  const units = project.commercialConfig?.reservableUnits || [];
  return (
    <div>
      <div className="space-y-2">
        {units.map((unit) => (
          <div key={unit.id} className="grid grid-cols-[1fr_80px] gap-2">
            <Input
              aria-label="Nome da acomodação"
              value={unit.name}
              onChange={(event) =>
                update({
                  reservableUnits: units.map((item) =>
                    item.id === unit.id
                      ? { ...item, name: event.target.value }
                      : item,
                  ),
                })
              }
            />
            <Input
              aria-label="Diária"
              type="number"
              value={unit.basePrice || 0}
              onChange={(event) =>
                update({
                  reservableUnits: units.map((item) =>
                    item.id === unit.id
                      ? { ...item, basePrice: Number(event.target.value) }
                      : item,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        onClick={() =>
          update({
            reservableUnits: [
              ...units,
              {
                id: uid("unit"),
                projectId: project.id,
                name: "Nova opção",
                capacityAdults: 2,
                capacityChildren: 0,
                quantity: 1,
                basePrice: 0,
                currency: "BRL",
                isActive: true,
                mediaAssetIds: [],
                amenities: [],
              },
            ],
          })
        }
      >
        Adicionar opção
      </Button>
    </div>
  );
}

function RoutingSettings({
  project,
  update,
}: {
  project: Project;
  update: (patch: Partial<NonNullable<Project["commercialConfig"]>>) => void;
}) {
  const destinations = project.commercialConfig?.routingDestinations || [];
  return (
    <div>
      <div className="space-y-2">
        {destinations.map((destination) => (
          <Input
            key={destination.id}
            aria-label="Nome do destino"
            value={destination.label}
            onChange={(event) =>
              update({
                routingDestinations: destinations.map((item) =>
                  item.id === destination.id
                    ? { ...item, label: event.target.value }
                    : item,
                ),
              })
            }
          />
        ))}
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="secondary"
        onClick={() =>
          update({
            routingDestinations: [
              ...destinations,
              {
                id: uid("destination"),
                key: `destino-${destinations.length + 1}`,
                type: "whatsapp",
                label: "Novo destino",
                value: project.phone,
              },
            ],
          })
        }
      >
        Adicionar destino
      </Button>
    </div>
  );
}
