"use client";

import { Braces, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { parseBlockContent } from "@/components/public-experience/blocks/block-schemas";
import { uid } from "@/lib/utils";
import type { ContentBlock, ContentBlockType, JourneyStep, Project } from "@/types";

const blockLabels: Record<ContentBlockType, string> = {
  text: "Texto", image: "Imagem", video: "Vídeo", choice_grid: "Grade de escolhas", choice_list: "Lista de escolhas", benefits: "Benefícios", testimonial: "Depoimento", form: "Formulário", recommendation_card: "Recomendação", cta_group: "Grupo de botões", location_card: "Unidade", product_cards: "Produtos", schedule_slots: "Horários", media_upload: "Envio de mídia", quantity_selector: "Quantidade", price_estimate: "Estimativa de preço", service_selector: "Seletor de serviços", resource_selector: "Seletor de recursos", calendar: "Calendário", date_range: "Período", guest_selector: "Hóspedes", availability_results: "Disponibilidade", reservable_unit_cards: "Opções de reserva", catalog_categories: "Categorias do catálogo", catalog_item_cards: "Itens do catálogo", cart_summary: "Resumo do carrinho", fulfillment_selector: "Entrega ou retirada", location_selector: "Seletor de unidades", route_result: "Resultado do roteamento", policy_card: "Política", deposit_card: "Sinal", booking_summary: "Resumo da reserva", quote_summary: "Resumo do orçamento",
};

const addableBlocks: ContentBlockType[] = [
  "text",
  "image",
  "choice_grid",
  "form",
  "media_upload",
  "quantity_selector",
  "price_estimate",
  "service_selector",
  "resource_selector",
  "calendar",
  "schedule_slots",
  "date_range",
  "guest_selector",
  "reservable_unit_cards",
  "catalog_categories",
  "catalog_item_cards",
  "cart_summary",
  "fulfillment_selector",
  "location_selector",
  "route_result",
  "policy_card",
  "deposit_card",
  "booking_summary",
  "quote_summary",
];

function defaultContent(type: ContentBlockType): Record<string, unknown> {
  if (type === "text") return { text: "Novo conteúdo" };
  if (type === "media_upload")
    return { fieldKey: "media", maxFiles: 4, required: false };
  if (type === "quantity_selector")
    return { fieldKey: "quantity", min: 1, max: 20 };
  if (type === "service_selector" || type === "location_selector")
    return {
      fieldKey: type === "service_selector" ? "service" : "location",
      options: [],
    };
  if (type === "resource_selector") return { resources: [] };
  if (type === "policy_card")
    return { text: "Consulte as políticas antes de confirmar." };
  if (type === "deposit_card") return { percent: 30, external: true };
  return {};
}

export function BlockEditor({
  step,
  project,
  mode,
  onChange,
}: {
  step: JourneyStep;
  project: Project;
  mode: "quick" | "advanced";
  onChange: (step: JourneyStep) => void;
}) {
  const [type, setType] = useState<ContentBlockType>("text");
  const blocks = step.blocks || [];
  function update(block: ContentBlock, content: Record<string, unknown>) {
    const parsed = typeSafeParse(block.type, content);
    if (!parsed.valid) return parsed.message;
    onChange({
      ...step,
      blocks: blocks.map((item) =>
        item.id === block.id ? { ...item, content } : item,
      ),
    });
    return "";
  }
  return (
    <div className="mt-6 border-t border-[#e5e4eb] pt-6">
      <div className="mb-3 flex items-center gap-2">
        <Braces size={16} className="text-[#6255d8]" />
        <Label>Blocos desta etapa</Label>
      </div>
      <div className="space-y-3">
        {blocks.map((block) => (
          mode === "advanced" ? <JsonBlock
            key={block.id}
            block={block}
            onUpdate={(content) => update(block, content)}
            onRemove={() =>
              onChange({
                ...step,
                blocks: blocks.filter((item) => item.id !== block.id),
              })
            }
          /> : <QuickBlock key={block.id} block={block} step={step} project={project} onUpdate={(content) => update(block, content)} onRemove={() => onChange({ ...step, blocks: blocks.filter((item) => item.id !== block.id) })} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Select
          aria-label="Tipo do novo bloco"
          value={type}
          onChange={(event) => setType(event.target.value as ContentBlockType)}
        >
          {addableBlocks.map((item) => (
            <option key={item} value={item}>
              {blockLabels[item]}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange({
              ...step,
              blocks: [
                ...blocks,
                { id: uid("block"), type, content: defaultContent(type) },
              ],
            })
          }
        >
          <Plus data-icon size={15} /> Bloco
        </Button>
      </div>
    </div>
  );
}

const quickTypes = new Set<ContentBlockType>(["text", "form", "choice_grid", "service_selector", "catalog_categories", "catalog_item_cards", "fulfillment_selector", "location_selector"]);

function QuickBlock({ block, step, project, onUpdate, onRemove }: { block: ContentBlock; step: JourneyStep; project: Project; onUpdate(content: Record<string, unknown>): string; onRemove(): void }) {
  const content = block.content || {};
  const [error, setError] = useState("");
  const commit = (next: Record<string, unknown>) => setError(onUpdate(next));
  const services = project.commercialConfig?.serviceOfferings?.filter((item) => item.isActive) || [];
  return <div className="rounded-[15px] border border-[#e3e2e9] bg-[#fafafd] p-3"><div className="mb-3 flex items-center justify-between"><strong className="text-[11px] uppercase tracking-wider text-[#5e52ce]">{blockLabels[block.type]}</strong><button type="button" onClick={onRemove} className="text-[#b84545]" aria-label={`Remover ${blockLabels[block.type]}`}><Trash2 size={15} /></button></div>
    {block.type === "text" ? <div><Label htmlFor={`block-text-${block.id}`}>Texto</Label><Textarea id={`block-text-${block.id}`} className="min-h-24" value={String(content.text || "")} onChange={(event) => commit({ ...content, text: event.target.value })} /></div> : null}
    {block.type === "form" ? <p className="text-xs leading-5 text-[#6f6d78]">Usa os {step.formFields?.length || 0} campos configurados no construtor visual desta etapa.</p> : null}
    {block.type === "choice_grid" ? <p className="text-xs leading-5 text-[#6f6d78]">Usa as {step.options?.length || 0} opções da etapa e seus destinos configurados.</p> : null}
    {block.type === "service_selector" ? <div className="grid gap-3"><div><Label htmlFor={`service-key-${block.id}`}>Chave da resposta</Label><Input id={`service-key-${block.id}`} value={String(content.fieldKey || "service")} onChange={(event) => commit({ ...content, fieldKey: event.target.value })} /></div><fieldset><legend className="mb-2 text-xs font-bold">Serviços exibidos</legend><div className="grid gap-2">{services.map((service) => { const selected = Array.isArray(content.services) && content.services.some((item) => typeof item === "object" && item && "id" in item && item.id === service.id); return <label key={service.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selected} onChange={(event) => { const current = Array.isArray(content.services) ? content.services.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : []; const next = event.target.checked ? [...current, { id: service.id, name: service.name }] : current.filter((item) => item.id !== service.id); commit({ ...content, services: next, options: undefined }); }} className="accent-[#6658d9]" />{service.name}</label>; })}</div></fieldset></div> : null}
    {block.type === "catalog_categories" ? <p className="text-xs leading-5 text-[#6f6d78]">Exibe automaticamente {project.commercialConfig?.catalogCategories?.length || 0} categorias ativas do catálogo.</p> : null}
    {block.type === "catalog_item_cards" ? <p className="text-xs leading-5 text-[#6f6d78]">Exibe automaticamente {project.commercialConfig?.catalogItems?.filter((item) => item.isAvailable).length || 0} itens disponíveis.</p> : null}
    {block.type === "fulfillment_selector" ? <p className="text-xs leading-5 text-[#6f6d78]">Mostra as opções de entrega e retirada habilitadas para o catálogo.</p> : null}
    {block.type === "location_selector" ? <div><Label htmlFor={`location-key-${block.id}`}>Chave da resposta</Label><Input id={`location-key-${block.id}`} value={String(content.fieldKey || "location")} onChange={(event) => commit({ ...content, fieldKey: event.target.value })} /><p className="mt-2 text-xs text-[#777580]">{project.commercialConfig?.locations?.filter((item) => item.isActive).length || 0} unidades ativas disponíveis.</p></div> : null}
    {!quickTypes.has(block.type) ? <p className="text-xs leading-5 text-[#6f6d78]">Este bloco usa os dados publicados do negócio. Abra o modo Avançado para editar sua configuração técnica.</p> : null}
    {error ? <small className="mt-2 block text-[#b84545]">{error}</small> : null}
  </div>;
}

function JsonBlock({
  block,
  onUpdate,
  onRemove,
}: {
  block: ContentBlock;
  onUpdate: (content: Record<string, unknown>) => string;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(() =>
    JSON.stringify(block.content || {}, null, 2),
  );
  const [error, setError] = useState("");
  function commit() {
    try {
      const content = JSON.parse(value) as Record<string, unknown>;
      setError(onUpdate(content));
    } catch {
      setError("JSON inválido. Corrija antes de sair do campo.");
    }
  }
  return (
    <div className="rounded-[15px] border border-[#e3e2e9] bg-[#fafafd] p-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[11px] uppercase tracking-wider text-[#5e52ce]">
          {block.type.replaceAll("_", " ")}
        </strong>
        <button
          type="button"
          onClick={onRemove}
          className="text-[#b84545]"
          aria-label={`Remover bloco ${block.type}`}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <Textarea
        aria-label={`Conteúdo JSON de ${block.type}`}
        className="min-h-28 font-mono text-[11px]"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
      />
      {error ? (
        <small className="mt-2 block text-[#b84545]">{error}</small>
      ) : null}
    </div>
  );
}

function typeSafeParse(
  type: ContentBlockType,
  content: Record<string, unknown>,
) {
  if (
    !(
      type in
      {
        media_upload: 1,
        quantity_selector: 1,
        service_selector: 1,
        resource_selector: 1,
        location_selector: 1,
        policy_card: 1,
        deposit_card: 1,
      }
    )
  )
    return { valid: true, message: "" };
  const parsed = parseBlockContent(
    type as
      | "media_upload"
      | "quantity_selector"
      | "service_selector"
      | "resource_selector"
      | "location_selector"
      | "policy_card"
      | "deposit_card",
    content,
  );
  return parsed.success
    ? { valid: true, message: "" }
    : {
        valid: false,
        message: parsed.error.issues[0]?.message || "Conteúdo inválido.",
      };
}
