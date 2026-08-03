"use client";

import { Braces, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/field";
import { parseBlockContent } from "@/components/public-experience/blocks/block-schemas";
import { uid } from "@/lib/utils";
import type { ContentBlock, ContentBlockType, JourneyStep } from "@/types";

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
  onChange,
}: {
  step: JourneyStep;
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
          <JsonBlock
            key={block.id}
            block={block}
            onUpdate={(content) => update(block, content)}
            onRemove={() =>
              onChange({
                ...step,
                blocks: blocks.filter((item) => item.id !== block.id),
              })
            }
          />
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
              {item.replaceAll("_", " ")}
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
