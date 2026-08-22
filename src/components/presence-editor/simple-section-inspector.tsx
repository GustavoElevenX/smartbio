"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, MoreHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleActionEditor } from "@/components/presence-editor/simple-action-editor";
import type {
  PresenceAction,
  PresencePage,
  PresenceSection,
} from "@/features/presence/presence.types";
import { presenceSectionRegistry } from "@/features/presence/section-registry";
import type { Project } from "@/types";

type SimpleSectionInspectorProps = {
  project: Project;
  page: PresencePage;
  section: PresenceSection;
  onChange(section: PresenceSection): void;
  onImprove(): void;
  onMove(direction: -1 | 1): void;
  onAdvanced(): void;
};

const input = "mt-2 min-h-11 w-full border border-[#cfd9e4] bg-white px-3 text-sm outline-none focus:border-[#0054fc] focus:ring-4 focus:ring-[#0054fc]/10";
const label = "block text-xs font-extrabold text-[#536178]";

function actionSlots(section: PresenceSection) {
  if (section.type === "hero" || section.type === "conversion_cta") {
    return [
      ["primaryAction", "Botão principal"],
      ["secondaryAction", "Botão secundário"],
    ] as const;
  }
  if (["about", "rich_text", "contact"].includes(section.type)) {
    return [["action", "Botão"]] as const;
  }
  if (section.type === "locations") return [["nearestAction", "Botão"]] as const;
  return [] as const;
}

export function SimpleSectionInspector({
  project,
  page,
  section,
  onChange,
  onImprove,
  onMove,
  onAdvanced,
}: SimpleSectionInspectorProps) {
  const content = section.content as Record<string, unknown>;
  const patchContent = (patch: Record<string, unknown>) => onChange({
    ...section,
    content: { ...section.content, ...patch },
  });
  const assets = (project.mediaAssets || []).filter(
    (asset) => asset.status !== "failed" && asset.mimeType.startsWith("image/"),
  );
  const mediaAssetId = section.type === "hero"
    ? (content.media as { assetId?: string } | undefined)?.assetId
    : typeof content.mediaAssetId === "string"
      ? content.mediaAssetId
      : undefined;
  const showMedia = section.type === "hero" || section.type === "about";
  const commercialItems = section.type === "products"
    ? project.commercialConfig?.catalogItems || []
    : section.type === "services"
      ? project.commercialConfig?.serviceOfferings || []
      : section.type === "locations"
        ? project.commercialConfig?.locations || []
      : [];
  const commercialKey = section.type === "products"
    ? "itemIds"
    : section.type === "services"
      ? "serviceIds"
      : "locationIds";
  const selectedItems = Array.isArray(content[commercialKey])
    ? content[commercialKey].filter((value): value is string => typeof value === "string")
    : [];

  return (
    <div className="flex flex-col gap-5" data-testid="simple-section-panel">
      <div>
        <p className="text-xs font-extrabold text-[#536178]">
          {presenceSectionRegistry[section.type].label}
        </p>
        <h2 className="mt-1 text-xl font-black tracking-[-.025em]">Edite esta parte</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={onImprove}>
          <Sparkles size={15} /> Melhorar com IA
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onChange({ ...section, isActive: !section.isActive })}>
          {section.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
          {section.isActive ? "Ocultar" : "Mostrar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onMove(-1)}>
          <ArrowUp size={15} /> Subir
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onMove(1)}>
          <ArrowDown size={15} /> Descer
        </Button>
      </div>

      <label className={label}>
        Título
        <input className={input} value={section.title || ""} onChange={(event) => onChange({ ...section, title: event.target.value || undefined })} />
      </label>
      <label className={label}>
        Texto
        <textarea className={`${input} min-h-24 py-3`} value={section.description || ""} onChange={(event) => onChange({ ...section, description: event.target.value || undefined })} />
      </label>

      {typeof content.body === "string" ? (
        <label className={label}>
          Conteúdo principal
          <textarea className={`${input} min-h-36 py-3`} value={content.body} onChange={(event) => patchContent({ body: event.target.value })} />
        </label>
      ) : null}

      {showMedia ? (
        <label className={label}>
          Imagem
          <select
            className={input}
            value={mediaAssetId || ""}
            onChange={(event) => {
              if (section.type === "hero") {
                const media = content.media as Record<string, unknown> | undefined;
                patchContent({ media: event.target.value ? { ...(media || {}), assetId: event.target.value } : undefined });
              } else {
                patchContent({ mediaAssetId: event.target.value || undefined });
              }
            }}
          >
            <option value="">Sem imagem</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.originalName}</option>)}
          </select>
        </label>
      ) : null}

      {commercialItems.length ? (
        <fieldset>
          <legend className="text-xs font-extrabold text-[#536178]">
            {section.type === "products"
              ? "Produtos exibidos"
              : section.type === "services"
                ? "Serviços exibidos"
                : "Unidades exibidas"}
          </legend>
          <div className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto border border-[#dfe6ee] p-3">
            {commercialItems.map((item) => (
              <label key={item.id} className="flex min-h-11 items-center gap-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={!selectedItems.length || selectedItems.includes(item.id)}
                  onChange={(event) => {
                    const base = selectedItems.length ? selectedItems : commercialItems.map((candidate) => candidate.id);
                    patchContent({
                      [commercialKey]: event.target.checked
                        ? [...new Set([...base, item.id])]
                        : base.filter((id) => id !== item.id),
                    });
                  }}
                />
                {item.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {section.type === "locations" ? (
        <fieldset>
          <legend className="text-xs font-extrabold text-[#536178]">Informações das unidades</legend>
          <div className="mt-2 flex flex-col gap-2">
            {[
              ["showOpeningHours", "Mostrar horários"],
              ["showPhone", "Mostrar telefone e WhatsApp"],
              ["showMapLink", "Mostrar link do mapa"],
            ].map(([key, text]) => (
              <label key={key} className="flex min-h-11 items-center gap-3 text-sm font-bold">
                <input type="checkbox" checked={content[key] !== false} onChange={(event) => patchContent({ [key]: event.target.checked })} />
                {text}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {section.type === "contact" ? (
        <div className="flex flex-col gap-4">
          {[
            ["email", "E-mail"],
            ["phone", "Telefone"],
            ["whatsapp", "WhatsApp"],
            ["address", "Endereço"],
          ].map(([key, text]) => (
            <label key={key} className={label}>
              {text}
              <input className={input} value={typeof content[key] === "string" ? content[key] : ""} onChange={(event) => patchContent({ [key]: event.target.value || undefined })} />
            </label>
          ))}
        </div>
      ) : null}

      {actionSlots(section).map(([key, actionLabel]) => (
        <SimpleActionEditor
          key={key}
          project={project}
          page={page}
          action={content[key] as PresenceAction | undefined}
          onChange={(action) => patchContent({ [key]: action })}
          labelText={actionLabel}
        />
      ))}

      <Button variant="ghost" className="justify-start" onClick={onAdvanced}>
        <MoreHorizontal size={16} /> Mais opções no modo avançado
      </Button>
    </div>
  );
}
