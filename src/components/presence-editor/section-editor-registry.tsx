"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- editors operate on content already validated by the section-specific Zod registry */

import { Plus, Trash2 } from "lucide-react";
import type { Project } from "@/types";
import type {
  PresenceAction,
  PresencePage,
  PresenceSection,
  PresenceSectionType,
} from "@/features/presence/presence.types";

interface EditorProps {
  project: Project;
  page: PresencePage;
  section: PresenceSection;
  onChange(section: PresenceSection): void;
}
const input =
  "mt-1 min-h-10 w-full rounded-xl border border-[#dedce7] bg-white px-3 text-sm outline-none focus:border-[#786be2] focus:ring-4 focus:ring-[#786be2]/10";
const label = "block text-xs font-extrabold text-[#55515e]";
function patchContent(props: EditorProps, patch: Record<string, unknown>) {
  props.onChange({
    ...props.section,
    content: { ...props.section.content, ...patch },
  });
}

function ActionEditor({
  project,
  page,
  action,
  onChange,
  labelText = "Ação",
}: {
  project: Project;
  page: PresencePage;
  action?: PresenceAction;
  onChange(action?: PresenceAction): void;
  labelText?: string;
}) {
  const defaultAction = {
      type: "start_conversion_goal",
      label: "Começar",
      conversionGoalId: project.conversionGoals?.find((goal) => goal.isActive)
        ?.id,
      style: "primary",
    } satisfies PresenceAction;
  if (!action) {
    return (
      <fieldset className="rounded-2xl border border-dashed border-[#d8d4e6] p-3">
        <legend className="px-1 text-xs font-black">{labelText}</legend>
        <p className="text-xs leading-5 text-[#746f7d]">
          Nenhuma ação configurada nesta posição.
        </p>
        <button
          type="button"
          onClick={() => onChange(defaultAction)}
          className="mt-3 inline-flex min-h-9 items-center rounded-xl bg-[#eeeafe] px-3 text-xs font-black text-[#5e50d1]"
        >
          <Plus size={14} className="mr-1.5" />
          Adicionar ação
        </button>
      </fieldset>
    );
  }
  const current = action;
  return (
    <fieldset className="rounded-2xl border border-[#e3e1e9] p-3">
      <legend className="px-1 text-xs font-black">{labelText}</legend>
      <label className={label}>
        Tipo
        <select
          className={input}
          value={current.type}
          onChange={(event) =>
            onChange({
              ...current,
              type: event.target.value as PresenceAction["type"],
            })
          }
        >
          <option value="start_conversion_goal">Iniciar conversão</option>
          <option value="go_to_presence_page">Ir para página</option>
          <option value="scroll_to_section">Rolar para seção</option>
          <option value="open_url">Abrir URL</option>
          <option value="open_whatsapp">Abrir WhatsApp</option>
        </select>
      </label>
      <label className={`${label} mt-3`}>
        Texto
        <input
          className={input}
          value={current.label}
          onChange={(event) =>
            onChange({ ...current, label: event.target.value })
          }
        />
      </label>
      {current.type === "start_conversion_goal" ? (
        <label className={`${label} mt-3`}>
          Meta
          <select
            className={input}
            value={current.conversionGoalId || ""}
            onChange={(event) =>
              onChange({
                ...current,
                conversionGoalId: event.target.value || undefined,
              })
            }
          >
            <option value="">Selecione</option>
            {(project.conversionGoals || [])
              .filter((goal) => goal.isActive)
              .map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      {current.type === "go_to_presence_page" ? (
        <label className={`${label} mt-3`}>
          Página
          <select
            className={input}
            value={current.pageId || page.id}
            onChange={(event) =>
              onChange({ ...current, pageId: event.target.value })
            }
          >
            {(project.presence?.pages || []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {current.type === "scroll_to_section" ? (
        <label className={`${label} mt-3`}>
          Âncora
          <input
            className={input}
            value={current.anchor || ""}
            onChange={(event) =>
              onChange({ ...current, anchor: event.target.value })
            }
          />
        </label>
      ) : null}
      {current.type === "open_url" ? (
        <label className={`${label} mt-3`}>
          URL
          <input
            className={input}
            type="url"
            value={current.url || ""}
            onChange={(event) =>
              onChange({ ...current, url: event.target.value })
            }
          />
        </label>
      ) : null}
      {current.type === "open_whatsapp" ? (
        <>
          <label className={`${label} mt-3`}>
            Telefone
            <input
              className={input}
              value={current.whatsappPhone || ""}
              onChange={(event) =>
                onChange({ ...current, whatsappPhone: event.target.value })
              }
            />
          </label>
          <label className={`${label} mt-3`}>
            Mensagem
            <textarea
              className={`${input} py-2`}
              value={current.whatsappMessage || ""}
              onChange={(event) =>
                onChange({ ...current, whatsappMessage: event.target.value })
              }
            />
          </label>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => onChange(undefined)}
        className="mt-3 text-xs font-bold text-[#a43b3b]"
      >
        Remover ação
      </button>
    </fieldset>
  );
}

function HeroEditor(props: EditorProps) {
  const content = props.section.content as any;
  return (
    <div className="space-y-3">
      <label className={label}>
        Alinhamento
        <select
          className={input}
          value={content.alignment || "left"}
          onChange={(event) =>
            patchContent(props, { alignment: event.target.value })
          }
        >
          <option value="left">À esquerda</option>
          <option value="center">Centralizado</option>
        </select>
      </label>
      <ActionEditor
        project={props.project}
        page={props.page}
        action={content.primaryAction}
        onChange={(primaryAction) => patchContent(props, { primaryAction })}
        labelText="Ação principal"
      />
      <ActionEditor
        project={props.project}
        page={props.page}
        action={content.secondaryAction}
        onChange={(secondaryAction) => patchContent(props, { secondaryAction })}
        labelText="Ação secundária"
      />
    </div>
  );
}
function ConversionEditor(props: EditorProps) {
  const content = props.section.content as any;
  return (
    <div className="space-y-3">
      <ActionEditor
        project={props.project}
        page={props.page}
        action={content.primaryAction}
        onChange={(primaryAction) =>
          primaryAction && patchContent(props, { primaryAction })
        }
        labelText="Ação principal"
      />
      <ActionEditor
        project={props.project}
        page={props.page}
        action={content.secondaryAction}
        onChange={(secondaryAction) => patchContent(props, { secondaryAction })}
        labelText="Ação secundária"
      />
    </div>
  );
}
function BodyEditor(props: EditorProps) {
  const content = props.section.content as any;
  return (
    <>
      <label className={label}>
        Conteúdo
        <textarea
          className={`${input} min-h-40 py-3`}
          value={content.body || ""}
          onChange={(event) =>
            patchContent(props, { body: event.target.value })
          }
        />
      </label>
      <div className="mt-3">
        <ActionEditor
          project={props.project}
          page={props.page}
          action={content.action}
          onChange={(action) => patchContent(props, { action })}
        />
      </div>
    </>
  );
}
function ContactEditor(props: EditorProps) {
  const content = props.section.content as any;
  const socialLinks: Array<{ label: string; url: string }> =
    content.socialLinks || [];
  const contactFields = [
    ["E-mail", "email", "email"],
    ["Telefone", "phone", "tel"],
    ["WhatsApp", "whatsapp", "tel"],
    ["Endereço", "address", "text"],
  ] as const;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3">
        {contactFields.map(([title, key, type]) => (
          <label key={key} className={label}>
            {title}
            <input
              className={input}
              type={type}
              value={content[key] || ""}
              onChange={(event) =>
                patchContent(props, { [key]: event.target.value || undefined })
              }
            />
          </label>
        ))}
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-black">Redes sociais</legend>
        <div className="flex flex-col gap-2">
          {socialLinks.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className="grid grid-cols-[1fr_1.5fr_auto] gap-2 rounded-xl border border-[#e3e1e9] p-2"
            >
              <input
                aria-label={`Nome da rede ${index + 1}`}
                className={input}
                value={item.label}
                placeholder="Instagram"
                onChange={(event) =>
                  patchContent(props, {
                    socialLinks: socialLinks.map((candidate, position) =>
                      position === index
                        ? { ...candidate, label: event.target.value }
                        : candidate,
                    ),
                  })
                }
              />
              <input
                aria-label={`URL da rede ${index + 1}`}
                className={input}
                type="url"
                value={item.url}
                placeholder="https://"
                onChange={(event) =>
                  patchContent(props, {
                    socialLinks: socialLinks.map((candidate, position) =>
                      position === index
                        ? { ...candidate, url: event.target.value }
                        : candidate,
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label={`Excluir rede ${index + 1}`}
                onClick={() =>
                  patchContent(props, {
                    socialLinks: socialLinks.filter(
                      (_, position) => position !== index,
                    ),
                  })
                }
                className="mt-1 grid size-10 place-items-center rounded-lg text-[#a43b3b] hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              patchContent(props, {
                socialLinks: [
                  ...socialLinks,
                  { label: "Instagram", url: "https://www.instagram.com/" },
                ],
              })
            }
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dedce7] px-3 text-xs font-bold"
          >
            <Plus size={14} />
            Adicionar rede
          </button>
        </div>
      </fieldset>
      <ActionEditor
        project={props.project}
        page={props.page}
        action={content.action}
        onChange={(action) => patchContent(props, { action })}
      />
    </div>
  );
}
function ItemsEditor(props: EditorProps) {
  const content = props.section.content as any;
  const items: any[] = content.items || [];
  const faq = props.section.type === "faq";
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id || index}
          className="rounded-2xl border border-[#e3e1e9] p-3"
        >
          <label className={label}>
            {faq ? "Pergunta" : "Título"}
            <input
              className={input}
              value={
                faq
                  ? item.question || ""
                  : item.title || item.name || item.value || ""
              }
              onChange={(event) => {
                const next = items.map((candidate, position) =>
                  position === index
                    ? {
                        ...candidate,
                        [faq
                          ? "question"
                          : item.name !== undefined
                            ? "name"
                            : item.value !== undefined
                              ? "value"
                              : "title"]: event.target.value,
                      }
                    : candidate,
                );
                patchContent(props, { items: next });
              }}
            />
          </label>
          <label className={`${label} mt-2`}>
            {faq ? "Resposta" : "Descrição"}
            <textarea
              className={`${input} py-2`}
              value={
                faq
                  ? item.answer || ""
                  : item.description || item.quote || item.label || ""
              }
              onChange={(event) => {
                const key = faq
                  ? "answer"
                  : item.quote !== undefined
                    ? "quote"
                    : item.label !== undefined
                      ? "label"
                      : "description";
                patchContent(props, {
                  items: items.map((candidate, position) =>
                    position === index
                      ? { ...candidate, [key]: event.target.value }
                      : candidate,
                  ),
                });
              }}
            />
          </label>
          <button
            type="button"
            aria-label="Excluir item"
            onClick={() =>
              patchContent(props, {
                items: items.filter((_, position) => position !== index),
              })
            }
            className="mt-2 inline-flex gap-1 text-xs font-bold text-[#a43b3b]"
          >
            <Trash2 size={13} />
            Excluir
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          patchContent(props, {
            items: [
              ...items,
              faq
                ? {
                    id: crypto.randomUUID(),
                    question: "Nova pergunta",
                    answer: "Escreva a resposta.",
                  }
                : {
                    id: crypto.randomUUID(),
                    title: "Novo item",
                    description: "Descreva este item.",
                  },
            ],
          })
        }
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dedce7] px-3 text-xs font-bold"
      >
        <Plus size={14} />
        Adicionar item
      </button>
    </div>
  );
}
function CommercialEditor(props: EditorProps) {
  const content = props.section.content as any;
  const services = props.section.type === "services";
  const options = services
    ? props.project.commercialConfig?.serviceOfferings || []
    : props.project.commercialConfig?.catalogItems || [];
  const key = services ? "serviceIds" : "itemIds";
  const chosen: string[] = content[key] || [];
  return (
    <div>
      <p className="text-xs leading-5 text-[#77727e]">
        Os cards usam os dados comerciais existentes. Nada é duplicado nesta
        seção.
      </p>
      <div className="mt-3 space-y-2">
        {options.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-2 rounded-xl border border-[#e3e1e9] p-3 text-sm font-bold"
          >
            <input
              type="checkbox"
              checked={!chosen.length || chosen.includes(item.id)}
              onChange={(event) => {
                const base = chosen.length
                  ? chosen
                  : options.map((candidate) => candidate.id);
                patchContent(props, {
                  [key]: event.target.checked
                    ? [...new Set([...base, item.id])]
                    : base.filter((id) => id !== item.id),
                });
              }}
            />
            {item.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function SectionLayoutEditor(props: EditorProps) {
  const content = props.section.content as any;
  if (props.section.type === "hero") return <div className="grid gap-3"><label className={label}>Composição<select className={input} value={content.variant || "split"} onChange={(event) => patchContent(props, { variant: event.target.value })}><option value="split">Dividido</option><option value="centered">Centralizado</option><option value="background">Imagem de fundo</option><option value="editorial">Editorial</option><option value="product_focus">Foco no produto</option><option value="minimal">Minimalista</option><option value="offer_focus">Foco na oferta</option></select></label><label className={label}>Posição da imagem<select className={input} value={content.media?.position || "right"} onChange={(event) => patchContent(props, { media: { ...(content.media || {}), position: event.target.value } })}><option value="right">Direita</option><option value="left">Esquerda</option><option value="background">Fundo</option></select></label></div>;
  if (props.section.type === "products" || props.section.type === "services") return <label className={label}>Layout<select className={input} value={content.layout || "grid"} onChange={(event) => patchContent(props, { layout: event.target.value })}><option value="grid">Grade</option>{props.section.type === "services" ? <option value="list">Lista</option> : null}<option value="featured">Destaque</option>{props.section.type === "products" ? <option value="carousel">Carrossel</option> : null}</select></label>;
  if (props.section.type === "testimonials") return <label className={label}>Layout<select className={input} value={content.layout || "cards"} onChange={(event) => patchContent(props, { layout: event.target.value })}><option value="cards">Cards</option><option value="quote">Citação</option><option value="carousel">Carrossel</option></select></label>;
  if (props.section.type === "gallery" || props.section.type === "portfolio") return <label className={label}>Layout<select className={input} value={content.layout || "grid"} onChange={(event) => patchContent(props, { layout: event.target.value })}><option value="grid">Grade</option><option value="masonry">Mosaico</option><option value="carousel">Carrossel</option></select></label>;
  return null;
}
function MediaEditor(props: EditorProps) {
  const content = props.section.content as any;
  const assets = (props.project.mediaAssets || []).filter(
    (asset) =>
      asset.status !== "failed" &&
      (asset.mimeType.startsWith("image/") ||
        asset.assetType === "image" ||
        asset.assetType === "logo" ||
        asset.assetType === "portfolio"),
  );
  const multi = ["gallery", "portfolio", "logo_cloud"].includes(
    props.section.type,
  );
  const selected: string[] = multi
    ? content.assetIds || []
    : props.section.type === "hero"
      ? [content.media?.assetId].filter(Boolean)
      : props.section.type === "video"
        ? [content.posterAssetId].filter(Boolean)
        : [content.mediaAssetId].filter(Boolean);
  function select(assetId: string, checked: boolean) {
    if (multi)
      return patchContent(props, {
        assetIds: checked
          ? [...new Set([...selected, assetId])]
          : selected.filter((id) => id !== assetId),
      });
    if (props.section.type === "hero")
      return patchContent(props, {
        media: checked
          ? {
              ...(content.media || {}),
              assetId,
              position: content.media?.position || "right",
            }
          : undefined,
      });
    if (props.section.type === "video")
      return patchContent(props, {
        posterAssetId: checked ? assetId : undefined,
      });
    patchContent(props, { mediaAssetId: checked ? assetId : undefined });
  }
  return (
    <div>
      <p className="text-xs leading-5 text-[#77727e]">
        Selecione arquivos da Media Library deste negócio. A seção guarda apenas
        referências, sem duplicar mídia.
      </p>
      {assets.length ? (
        <div className="mt-3 grid gap-2">
          {assets.map((asset) => (
            <label
              key={asset.id}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-[#e3e1e9] p-3 text-xs font-bold"
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={multi ? undefined : `media-${props.section.id}`}
                checked={selected.includes(asset.id)}
                onChange={(event) => select(asset.id, event.target.checked)}
              />
              <span className="min-w-0 flex-1 truncate">
                {asset.originalName}
              </span>
              <span className="text-[9px] uppercase text-[#8a8691]">
                {asset.assetType || "imagem"}
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-[#f4f3f7] p-3 text-xs text-[#77727e]">
          Nenhuma imagem pronta na Media Library. Envie arquivos em Mídia e
          volte para selecionar.
        </p>
      )}
    </div>
  );
}
function SimpleEditor(props: EditorProps) {
  const content = props.section.content as any;
  const fields = Object.entries(content).filter(
    ([, value]) => typeof value === "string" || typeof value === "boolean",
  );
  return (
    <div className="space-y-3">
      {fields.map(([key, value]) =>
        typeof value === "boolean" ? (
          <label
            key={key}
            className="flex items-center justify-between gap-3 text-xs font-extrabold"
          >
            {key}
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) =>
                patchContent(props, { [key]: event.target.checked })
              }
            />
          </label>
        ) : (
          <label key={key} className={label}>
            {key}
            <input
              className={input}
              value={String(value)}
              onChange={(event) =>
                patchContent(props, { [key]: event.target.value })
              }
            />
          </label>
        ),
      )}
      {!fields.length ? (
        <p className="rounded-xl bg-[#f4f3f7] p-3 text-xs text-[#77727e]">
          Esta seção usa a biblioteca de mídia ou dados confirmados do projeto.
        </p>
      ) : null}
    </div>
  );
}

export const sectionEditorRegistry: Record<
  PresenceSectionType,
  (props: EditorProps) => React.ReactNode
> = {
  hero: HeroEditor,
  rich_text: BodyEditor,
  benefits: ItemsEditor,
  feature_grid: ItemsEditor,
  services: CommercialEditor,
  products: CommercialEditor,
  about: BodyEditor,
  stats: ItemsEditor,
  logo_cloud: MediaEditor,
  gallery: MediaEditor,
  portfolio: MediaEditor,
  testimonials: ItemsEditor,
  faq: ItemsEditor,
  pricing: ItemsEditor,
  locations: SimpleEditor,
  contact: ContactEditor,
  video: SimpleEditor,
  conversion_cta: ConversionEditor,
  divider: SimpleEditor,
};

export function SectionInspector(props: EditorProps & { appearanceOnly?: boolean }) {
  const Editor = sectionEditorRegistry[props.section.type];
  const backgroundAssets = (props.project.mediaAssets || []).filter(
    (asset) =>
      asset.status !== "failed" &&
      (asset.assetType === "background" || asset.mimeType.startsWith("image/")),
  );
  const patchStyle = (patch: Partial<PresenceSection["style"]>) =>
    props.onChange({
      ...props.section,
      style: { ...props.section.style, ...patch },
    });
  return (
    <div className="flex flex-col gap-4">
      {!props.appearanceOnly ? <>
      <div className="grid gap-3">
        <label className={label}>
          Sobrancelha
          <input
            className={input}
            value={props.section.eyebrow || ""}
            onChange={(event) =>
              props.onChange({
                ...props.section,
                eyebrow: event.target.value || undefined,
              })
            }
          />
        </label>
        <label className={label}>
          Título
          <input
            className={input}
            value={props.section.title || ""}
            onChange={(event) =>
              props.onChange({
                ...props.section,
                title: event.target.value || undefined,
              })
            }
          />
        </label>
        <label className={label}>
          Descrição
          <textarea
            className={`${input} min-h-24 py-2`}
            value={props.section.description || ""}
            onChange={(event) =>
              props.onChange({
                ...props.section,
                description: event.target.value || undefined,
              })
            }
          />
        </label>
        <label className={label}>
          Âncora
          <input
            className={input}
            value={props.section.anchor || ""}
            onChange={(event) =>
              props.onChange({
                ...props.section,
                anchor:
                  event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") ||
                  undefined,
              })
            }
          />
        </label>
      </div>
      {["hero", "about"].includes(props.section.type) ? (
        <>
          <div className="h-px bg-[#e8e6ed]" />
          <MediaEditor {...props} />
        </>
      ) : null}
      <div className="h-px bg-[#e8e6ed]" />
      {Editor(props)}
      </> : null}
      {props.appearanceOnly ? <SectionLayoutEditor {...props} /> : null}
      {props.appearanceOnly ? <fieldset>
        <legend className="mb-3 text-xs font-black uppercase tracking-[.12em] text-[#77727e]">
          Aparência
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Fundo
            <select
              className={input}
              value={props.section.style.theme || "default"}
              onChange={(event) =>
                patchStyle({
                  theme: event.target
                    .value as PresenceSection["style"]["theme"],
                })
              }
            >
              <option value="default">Padrão</option>
              <option value="muted">Suave</option>
              <option value="brand">Marca</option>
              <option value="dark">Escuro</option>
            </select>
          </label>
          <label className={label}>
            Espaçamento
            <select
              className={input}
              value={props.section.style.spacing || "normal"}
              onChange={(event) =>
                patchStyle({
                  spacing: event.target
                    .value as PresenceSection["style"]["spacing"],
                })
              }
            >
              <option value="compact">Compacto</option>
              <option value="normal">Normal</option>
              <option value="airy">Amplo</option>
            </select>
          </label>
          <label className={label}>
            Largura
            <select
              className={input}
              value={props.section.style.width || "inherit"}
              onChange={(event) =>
                patchStyle({
                  width:
                    event.target.value === "inherit"
                      ? undefined
                      : (event.target
                          .value as PresenceSection["style"]["width"]),
                })
              }
            >
              <option value="inherit">Usar página</option>
              <option value="md">Estreita</option>
              <option value="lg">Média</option>
              <option value="xl">Ampla</option>
              <option value="full">Tela inteira</option>
            </select>
          </label>
          <label className={label}>
            Cantos
            <select
              className={input}
              value={props.section.style.radius || "inherit"}
              onChange={(event) =>
                patchStyle({
                  radius:
                    event.target.value === "inherit"
                      ? undefined
                      : (event.target
                          .value as PresenceSection["style"]["radius"]),
                })
              }
            >
              <option value="inherit">Usar marca</option>
              <option value="none">Retos</option>
              <option value="sm">Discretos</option>
              <option value="md">Médios</option>
              <option value="lg">Amplos</option>
            </select>
          </label>
          <label className={label}>
            Tratamento da mídia
            <select
              className={input}
              value={props.section.style.mediaTreatment || "inherit"}
              onChange={(event) =>
                patchStyle({
                  mediaTreatment:
                    event.target.value === "inherit"
                      ? undefined
                      : (event.target
                          .value as PresenceSection["style"]["mediaTreatment"]),
                })
              }
            >
              <option value="inherit">Padrão</option>
              <option value="plain">Sem moldura</option>
              <option value="rounded">Arredondada</option>
              <option value="frame">Emoldurada</option>
            </select>
          </label>
          <label className={label}>
            Imagem de fundo
            <select
              className={input}
              value={props.section.style.backgroundAssetId || ""}
              onChange={(event) =>
                patchStyle({
                  backgroundAssetId: event.target.value || undefined,
                })
              }
            >
              <option value="">Nenhuma</option>
              {backgroundAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset> : null}
    </div>
  );
}
