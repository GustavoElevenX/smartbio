"use client";

import {
  CalendarDays,
  Check,
  ImagePlus,
  MapPin,
  Minus,
  Plus,
  Route,
  ShoppingBag,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  calculateOrderTotals,
  createOrderItem,
} from "@/features/catalog/order-engine";
import { calculateQuoteEstimate } from "@/features/quotes/quote-engine";
import {
  calculateReservationTotal,
  reservationNights,
} from "@/features/reservations/reservation-engine";
import { cn } from "@/lib/utils";
import type { ContentBlockType, QuoteDefinition } from "@/types";
import { parseBlockContent } from "@/components/public-experience/blocks/block-schemas";
import { LocationFinder } from "@/components/public-experience/location-finder";
import type {
  BlockRenderer,
  BlockRendererProps,
} from "@/components/public-experience/blocks/block-types";

const cardClass =
  "rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]";

const EmptyBlock: BlockRenderer = () => null;

const TextBlock: BlockRenderer = ({ block }) => (
  <p className="text-sm leading-6 text-[var(--muted-fg)]">
    {String(block.content?.text || "")}
  </p>
);
const ImageBlock: BlockRenderer = ({ block }) =>
  typeof block.content?.url === "string" ? (
    <img
      src={block.content.url}
      alt={String(block.content.alt || "Imagem da experiência")}
      className="max-h-72 w-full rounded-[var(--card-radius)] object-cover"
    />
  ) : null;

const LocationCardBlock: BlockRenderer = ({ block, runtime, setRuntime }) => {
  const content = block.content || {};
  const id = String(content.id || content.name || "location");
  const selected = runtime.selectedLocationId === id;
  return (
    <button
      type="button"
      onClick={() =>
        setRuntime((current) => ({
          ...current,
          selectedLocationId: id,
          answers: { ...current.answers, location: String(content.name || id) },
        }))
      }
      className={cn(
        cardClass,
        "w-full text-left transition",
        selected && "ring-4 ring-[var(--primary)]/15",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]">
          <MapPin size={21} />
        </span>
        <span className="flex-1">
          <strong className="block text-lg">
            {String(content.name || "Unidade")}
          </strong>
          <small className="mt-1 block text-[var(--muted-fg)]">
            {String(content.address || "")}
          </small>
        </span>
        {selected ? (
          <Check size={18} className="text-[var(--primary)]" />
        ) : null}
      </div>
      <div className="mt-4 flex gap-2">
        <span className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-xs font-bold">
          {String(content.eta || "")}
        </span>
        <span className="rounded-full bg-[var(--muted)] px-3 py-1.5 text-xs font-bold text-[var(--primary)]">
          {String(content.status || "disponível")}
        </span>
      </div>
    </button>
  );
};

const LegacyProductCardsBlock: BlockRenderer = ({
  block,
  project,
  runtime,
  setRuntime,
  emit,
}) => {
  const legacy = Array.isArray(block.content?.products)
    ? (block.content.products as Array<Record<string, unknown>>)
    : [];
  const items = project.commercialConfig?.catalogItems || [];
  const products = items.length
    ? items
    : legacy.map((item, index) => ({
        id: `legacy-${index}`,
        projectId: project.id,
        name: String(item.name),
        description: String(item.price || ""),
        price:
          Number(
            String(item.price || "")
              .replace(/[^0-9,]/g, "")
              .replace(",", "."),
          ) || 0,
        currency: "BRL",
        isAvailable: true,
        variants: [],
        metadata: { emoji: item.emoji },
      }));
  function add(item: (typeof products)[number]) {
    const existing = runtime.cart.items.find(
      (candidate) => candidate.itemId === item.id,
    );
    const nextItems = existing
      ? runtime.cart.items.map((candidate) =>
          candidate.itemId === item.id
            ? { ...candidate, quantity: candidate.quantity + 1 }
            : candidate,
        )
      : [...runtime.cart.items, createOrderItem(item)];
    setRuntime((current) => ({
      ...current,
      selectedOfferIds: [...new Set([...current.selectedOfferIds, item.id])],
      cart: {
        ...current.cart,
        items: nextItems,
        totals: calculateOrderTotals(nextItems, { currency: item.currency }),
      },
    }));
    emit("item_added", { itemId: item.id, itemName: item.name });
  }
  return (
    <div className="grid gap-2">
      {products.map((product) => (
        <button
          type="button"
          key={product.id}
          onClick={() => add(product)}
          className="flex items-center gap-3 rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-3 text-left shadow-[var(--card-shadow)]"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)] text-2xl">
            {String(product.metadata.emoji || "✨")}
          </span>
          <span className="flex-1">
            <strong className="block text-sm">{product.name}</strong>
            <small className="text-[var(--muted-fg)]">
              {product.price
                ? new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: product.currency,
                  }).format(product.price)
                : product.description}
            </small>
          </span>
          <Plus size={18} className="text-[var(--primary)]" />
        </button>
      ))}
    </div>
  );
};

const MediaUploadBlock: BlockRenderer = ({
  block,
  runtime,
  setRuntime,
  mediaFilesRef,
  emit,
}) => {
  const parsed = parseBlockContent("media_upload", block.content);
  const config = parsed.success
    ? parsed.data
    : { fieldKey: "media", maxFiles: 4, required: false };
  const [error, setError] = useState("");
  function select(files: FileList | null) {
    const accepted = [...(files || [])]
      .filter(
        (file) =>
          ["image/png", "image/jpeg", "image/webp"].includes(file.type) &&
          file.size <= 5_242_880,
      )
      .slice(0, config.maxFiles);
    if (!accepted.length && files?.length) {
      setError("Use PNG, JPG ou WebP de até 5 MB.");
      return;
    }
    mediaFilesRef.current = accepted;
    const attachments = accepted.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type,
      size: file.size,
    }));
    setRuntime((current) => ({
      ...current,
      quoteDraft: {
        answers: current.quoteDraft?.answers || {},
        attachments,
        currency: current.quoteDraft?.currency || "BRL",
        estimatedMin: current.quoteDraft?.estimatedMin,
        estimatedMax: current.quoteDraft?.estimatedMax,
      },
      answers: {
        ...current.answers,
        [config.fieldKey]: attachments.map((item) => item.name),
      },
    }));
    setError("");
    emit("media_uploaded", { count: accepted.length });
  }
  const count = runtime.quoteDraft?.attachments.length || 0;
  return (
    <label
      className={cn(
        cardClass,
        "flex cursor-pointer flex-col items-center justify-center border-dashed text-center",
      )}
    >
      <span className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]">
        {count ? <ImagePlus size={21} /> : <UploadCloud size={21} />}
      </span>
      <strong className="mt-3 text-sm">
        {count
          ? `${count} foto${count > 1 ? "s" : ""} selecionada${count > 1 ? "s" : ""}`
          : "Enviar fotos"}
      </strong>
      <small className="mt-1 text-[var(--muted-fg)]">
        PNG, JPG ou WebP · até {config.maxFiles} arquivos
      </small>
      <input
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        required={config.required && !count}
        onChange={(event) => select(event.target.files)}
      />
      {error ? (
        <span className="mt-2 text-xs text-[var(--destructive)]">{error}</span>
      ) : null}
    </label>
  );
};

const QuantitySelectorBlock: BlockRenderer = ({
  block,
  runtime,
  setRuntime,
}) => {
  const parsed = parseBlockContent("quantity_selector", block.content);
  const config = parsed.success
    ? parsed.data
    : { fieldKey: "quantity", min: 1, max: 20 };
  const value = Number(runtime.answers[config.fieldKey] || config.min);
  const set = (next: number) =>
    setRuntime((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [config.fieldKey]: Math.min(config.max, Math.max(config.min, next)),
      },
      quoteDraft: current.quoteDraft
        ? {
            ...current.quoteDraft,
            answers: {
              ...current.quoteDraft.answers,
              [config.fieldKey]: Math.min(
                config.max,
                Math.max(config.min, next),
              ),
            },
          }
        : current.quoteDraft,
    }));
  return (
    <div className={cn(cardClass, "flex items-center gap-4")}>
      <span className="flex-1">
        <strong className="block text-sm">Quantidade</strong>
        <small className="text-[var(--muted-fg)]">
          Informe quantos itens serão atendidos
        </small>
      </span>
      <button
        type="button"
        aria-label="Diminuir quantidade"
        onClick={() => set(value - 1)}
        className="grid size-10 place-items-center rounded-xl bg-[var(--muted)]"
      >
        <Minus size={16} />
      </button>
      <strong className="min-w-8 text-center text-lg">{value}</strong>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        onClick={() => set(value + 1)}
        className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)]"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

const ServiceSelectorBlock: BlockRenderer = ({
  block,
  runtime,
  setRuntime,
}) => {
  const parsed = parseBlockContent("service_selector", block.content);
  const config = parsed.success
    ? parsed.data
    : { fieldKey: "service", options: [], services: [] };
  const values = config.services?.length
    ? config.services.map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.durationMinutes ? `${item.durationMinutes} min` : "",
      }))
    : (config.options || []).map((item) => ({
        id: item,
        label: item,
        detail: "",
      }));
  const currentValue = String(
    runtime.answers[config.fieldKey] || runtime.answers.serviceId || "",
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {values.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() =>
            setRuntime((current) => ({
              ...current,
              answers: {
                ...current.answers,
                [config.fieldKey]: item.label,
                serviceId: item.id,
              },
            }))
          }
          className={cn(
            cardClass,
            "text-left transition",
            currentValue === item.id || currentValue === item.label
              ? "ring-4 ring-[var(--primary)]/15"
              : "",
          )}
        >
          <strong className="block text-sm">{item.label}</strong>
          {item.detail ? (
            <small className="mt-1 block text-[var(--muted-fg)]">
              {item.detail}
            </small>
          ) : null}
        </button>
      ))}
    </div>
  );
};

const ResourceSelectorBlock: BlockRenderer = ({
  block,
  runtime,
  setRuntime,
}) => {
  const parsed = parseBlockContent("resource_selector", block.content);
  const resources = parsed.success ? parsed.data.resources : [];
  return (
    <div className="grid gap-2">
      {resources.map((resource) => (
        <button
          type="button"
          key={resource.id}
          onClick={() =>
            setRuntime((current) => ({
              ...current,
              selectedResourceId: resource.id,
            }))
          }
          className={cn(
            cardClass,
            "text-left",
            runtime.selectedResourceId === resource.id &&
              "ring-4 ring-[var(--primary)]/15",
          )}
        >
          <strong className="text-sm">{resource.name}</strong>
        </button>
      ))}
    </div>
  );
};

const CalendarBlock: BlockRenderer = ({ runtime, setRuntime }) => {
  const [tomorrow] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10);
  });
  return (
    <label className={cn(cardClass, "block")}>
      <span className="mb-2 flex items-center gap-2 text-xs font-bold">
        <CalendarDays size={16} /> Data
      </span>
      <input
        aria-label="Data do agendamento"
        type="date"
        min={tomorrow}
        value={String(runtime.answers.schedule_date || tomorrow)}
        onChange={(event) =>
          setRuntime((current) => ({
            ...current,
            answers: { ...current.answers, schedule_date: event.target.value },
            selectedSlot: undefined,
          }))
        }
        className="min-h-11 w-full rounded-[var(--input-radius)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"
      />
    </label>
  );
};

const ScheduleSlotsBlock: BlockRenderer = ({
  block,
  project,
  runtime,
  setRuntime,
  emit,
}) => {
  const legacySlots = Array.isArray(block.content?.slots)
    ? block.content.slots.map(String)
    : [];
  const [slots, setSlots] = useState<
    Array<{ startsAt: string; endsAt: string; label: string }>
  >(legacySlots.map((label) => ({ startsAt: label, endsAt: label, label })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    const service =
      project.commercialConfig?.schedulableServices?.find(
        (item) => item.id === runtime.answers.serviceId,
      ) || project.commercialConfig?.schedulableServices?.[0];
    if (!service) return;
    const date = String(
      runtime.answers.schedule_date ||
        new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    );
    setBusy(true);
    setError("");
    emit("availability_searched", { date, serviceId: service.id });
    try {
      const response = await fetch("/api/public/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          serviceId: service.id,
          resourceId: runtime.selectedResourceId,
          date,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { slots?: Array<{ startsAt: string; endsAt: string }> };
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.error?.message || "Não foi possível consultar a agenda.",
        );
      setSlots(
        (payload.data?.slots || []).map((slot) => ({
          ...slot,
          label: new Date(slot.startsAt).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar a agenda.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void search()}
        disabled={busy}
        className="mb-3 min-h-11 w-full rounded-[var(--button-radius)] bg-[var(--muted)] px-4 text-sm font-bold text-[var(--primary)]"
      >
        {busy ? "Atualizando horários…" : "Consultar horários"}
      </button>
      {error ? (
        <p role="alert" className="mb-3 text-xs text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <button
            type="button"
            key={slot.startsAt}
            onClick={() => {
              setRuntime((current) => ({
                ...current,
                selectedSlot: slot.startsAt,
                answers: { ...current.answers, booking_ends_at: slot.endsAt },
              }));
              emit("slot_selected", { startsAt: slot.startsAt });
            }}
            className={cn(
              "min-h-11 rounded-[var(--input-radius)] border px-3 text-xs font-bold",
              runtime.selectedSlot === slot.startsAt
                ? "border-[var(--primary)] bg-[var(--muted)] text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            {slot.label}
          </button>
        ))}
      </div>
      {!busy && !slots.length ? (
        <p className="py-4 text-center text-xs text-[var(--muted-fg)]">
          Nenhum horário disponível nesta data.
        </p>
      ) : null}
    </div>
  );
};

const FulfillmentSelectorBlock: BlockRenderer = ({ runtime, setRuntime }) => (
  <div className="grid grid-cols-2 gap-2">
    {(["delivery", "pickup"] as const).map((value) => (
      <button
        type="button"
        key={value}
        onClick={() =>
          setRuntime((current) => ({
            ...current,
            cart: { ...current.cart, fulfillment: value },
          }))
        }
        className={cn(
          cardClass,
          "text-sm font-bold",
          runtime.cart.fulfillment === value &&
            "ring-4 ring-[var(--primary)]/15",
        )}
      >
        {value === "delivery" ? "Entrega" : "Retirada"}
      </button>
    ))}
  </div>
);

const CatalogCategoriesBlock: BlockRenderer = ({ project }) => (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {(project.commercialConfig?.catalogCategories || [])
      .filter((item) => item.isActive)
      .map((category) => (
        <span
          key={category.id}
          className="whitespace-nowrap rounded-full bg-[var(--muted)] px-3 py-2 text-xs font-bold text-[var(--primary)]"
        >
          {category.name}
        </span>
      ))}
  </div>
);
const CatalogItemCardsBlock = LegacyProductCardsBlock;

const CartSummaryBlock: BlockRenderer = ({ runtime, setRuntime, emit }) => {
  function quantity(itemId: string, delta: number) {
    const items = runtime.cart.items
      .map((item) =>
        item.itemId === itemId
          ? { ...item, quantity: item.quantity + delta }
          : item,
      )
      .filter((item) => item.quantity > 0);
    setRuntime((current) => ({
      ...current,
      cart: {
        ...current.cart,
        items,
        totals: calculateOrderTotals(items, {
          currency: current.cart.totals.currency,
        }),
      },
    }));
    emit("cart_viewed", { itemCount: items.length });
  }
  if (!runtime.cart.items.length)
    return (
      <div
        className={cn(cardClass, "text-center text-sm text-[var(--muted-fg)]")}
      >
        <ShoppingBag className="mx-auto mb-2" size={20} />
        Seu carrinho está vazio.
      </div>
    );
  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-3">
        {runtime.cart.items.map((item) => (
          <div
            key={`${item.itemId}-${item.variantId || "base"}`}
            className="flex items-center gap-3"
          >
            <span className="flex-1">
              <strong className="block text-sm">{item.name}</strong>
              <small className="text-[var(--muted-fg)]">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: runtime.cart.totals.currency,
                }).format(item.unitPrice)}
              </small>
            </span>
            <button
              type="button"
              aria-label={`Diminuir ${item.name}`}
              onClick={() => quantity(item.itemId, -1)}
              className="grid size-8 place-items-center rounded-lg bg-[var(--muted)]"
            >
              <Minus size={14} />
            </button>
            <strong className="text-sm">{item.quantity}</strong>
            <button
              type="button"
              aria-label={`Aumentar ${item.name}`}
              onClick={() => quantity(item.itemId, 1)}
              className="grid size-8 place-items-center rounded-lg bg-[var(--muted)]"
            >
              <Plus size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4 text-sm">
        <span>Total</span>
        <strong>
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: runtime.cart.totals.currency,
          }).format(runtime.cart.totals.total)}
        </strong>
      </div>
    </div>
  );
};

const DateRangeBlock: BlockRenderer = ({ runtime, setRuntime, emit }) => {
  const [min] = useState(() => {
    const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10);
  });
  const range = runtime.selectedDateRange || { start: "", end: "" };
  const change = (key: "start" | "end", value: string) => {
    const next = { ...range, [key]: value };
    setRuntime((current) => ({
      ...current,
      selectedDateRange: next,
      selectedOfferIds: [],
    }));
    if (next.start && next.end) emit("reservation_search_started", next);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className={cardClass}>
        <span className="mb-2 block text-xs font-bold">Entrada</span>
        <input
          aria-label="Data de entrada"
          type="date"
          min={min}
          value={range.start}
          onChange={(event) => change("start", event.target.value)}
          className="w-full bg-transparent text-sm"
        />
      </label>
      <label className={cardClass}>
        <span className="mb-2 block text-xs font-bold">Saída</span>
        <input
          aria-label="Data de saída"
          type="date"
          min={range.start || min}
          value={range.end}
          onChange={(event) => change("end", event.target.value)}
          className="w-full bg-transparent text-sm"
        />
      </label>
    </div>
  );
};

const GuestSelectorBlock: BlockRenderer = ({ runtime, setRuntime }) => {
  const guests = runtime.guests || { adults: 2, children: 0 };
  const update = (key: "adults" | "children", delta: number) =>
    setRuntime((current) => ({
      ...current,
      guests: {
        ...guests,
        [key]: Math.max(key === "adults" ? 1 : 0, guests[key] + delta),
      },
      selectedOfferIds: [],
    }));
  return (
    <div className={cardClass}>
      {(["adults", "children"] as const).map((key) => (
        <div key={key} className="flex items-center gap-3 py-2">
          <span className="flex-1 text-sm font-semibold">
            {key === "adults" ? "Adultos" : "Crianças"}
          </span>
          <button
            type="button"
            aria-label={`Diminuir ${key === "adults" ? "adultos" : "crianças"}`}
            onClick={() => update(key, -1)}
            className="grid size-8 place-items-center rounded-lg bg-[var(--muted)]"
          >
            <Minus size={14} />
          </button>
          <strong className="w-6 text-center text-sm">{guests[key]}</strong>
          <button
            type="button"
            aria-label={`Aumentar ${key === "adults" ? "adultos" : "crianças"}`}
            onClick={() => update(key, 1)}
            className="grid size-8 place-items-center rounded-lg bg-[var(--muted)]"
          >
            <Plus size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const AvailabilityResultsBlock: BlockRenderer = () => null;

const ReservableUnitCardsBlock: BlockRenderer = ({
  project,
  runtime,
  setRuntime,
  emit,
}) => {
  const [results, setResults] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      total: number;
      availableQuantity: number;
      currency: string;
      amenities: string[];
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search() {
    if (!runtime.selectedDateRange?.start || !runtime.selectedDateRange.end) {
      setError("Escolha entrada e saída.");
      return;
    }
    setBusy(true);
    setError("");
    emit("availability_searched", { kind: "reservation" });
    try {
      const response = await fetch("/api/public/reservations/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          checkIn: runtime.selectedDateRange.start,
          checkOut: runtime.selectedDateRange.end,
          adults: runtime.guests?.adults || 2,
          children: runtime.guests?.children || 0,
        }),
      });
      const payload = (await response.json()) as {
        data?: { units?: typeof results };
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(
          payload.error?.message || "Não foi possível consultar as datas.",
        );
      setResults(payload.data?.units || []);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível consultar as datas.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void search()}
        disabled={busy}
        className="mb-3 min-h-11 w-full rounded-[var(--button-radius)] bg-[var(--muted)] px-4 text-sm font-bold text-[var(--primary)]"
      >
        {busy ? "Consultando disponibilidade…" : "Consultar disponibilidade"}
      </button>
      {error ? (
        <p role="alert" className="mb-3 text-xs text-[var(--destructive)]">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2">
        {results.map((unit) => (
          <button
            type="button"
            key={unit.id}
            onClick={() => {
              setRuntime((current) => ({
                ...current,
                selectedOfferIds: [unit.id],
                answers: {
                  ...current.answers,
                  reservation_unit: unit.name,
                  reservation_total: unit.total,
                },
              }));
              emit("reservation_option_viewed", { unitId: unit.id });
            }}
            className={cn(
              cardClass,
              "text-left",
              runtime.selectedOfferIds.includes(unit.id) &&
                "ring-4 ring-[var(--primary)]/15",
            )}
          >
            <div className="flex justify-between gap-3">
              <span>
                <strong className="block">{unit.name}</strong>
                <small className="mt-1 block text-[var(--muted-fg)]">
                  {unit.description}
                </small>
              </span>
              <strong className="whitespace-nowrap text-[var(--primary)]">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: unit.currency,
                }).format(unit.total)}
              </strong>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {unit.amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full bg-[var(--muted)] px-2 py-1 text-[10px] font-bold"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const PriceEstimateBlock: BlockRenderer = ({
  project,
  runtime,
  setRuntime,
  emit,
}) => {
  const definition = project.commercialConfig?.quoteDefinition;
  if (!definition) return null;
  return <PriceEstimateContent definition={definition} runtime={runtime} setRuntime={setRuntime} emit={emit} />;
};

function PriceEstimateContent({ definition, runtime, setRuntime, emit }: {
  definition: QuoteDefinition;
  runtime: BlockRendererProps["runtime"];
  setRuntime: BlockRendererProps["setRuntime"];
  emit: BlockRendererProps["emit"];
}) {
  const estimate = calculateQuoteEstimate(
    definition!,
    definition!.rules,
    runtime.answers,
  );
  const key = `${estimate.min}-${estimate.max}`;
  useEffect(() => {
    if (
      runtime.quoteDraft?.estimatedMin !== estimate.min ||
      runtime.quoteDraft?.estimatedMax !== estimate.max
    ) {
      setRuntime((current) => ({
        ...current,
        quoteDraft: {
          answers: current.answers,
          attachments: current.quoteDraft?.attachments || [],
          currency: estimate.currency,
          estimatedMin: estimate.min,
          estimatedMax: estimate.max,
        },
      }));
    }
  }, [
    estimate.currency,
    estimate.max,
    estimate.min,
    runtime.quoteDraft?.estimatedMax,
    runtime.quoteDraft?.estimatedMin,
    setRuntime,
  ]);
  const label = estimate.requiresManualReview
    ? "Avaliação necessária"
    : estimate.min === estimate.max
      ? new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: estimate.currency,
        }).format(estimate.min || 0)
      : `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: estimate.currency }).format(estimate.min || 0)} – ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: estimate.currency }).format(estimate.max || 0)}`;
  return (
    <div
      key={key}
      className={cn(cardClass, "bg-[var(--muted)] text-center")}
      onMouseEnter={() =>
        emit("quote_estimate_viewed", { min: estimate.min, max: estimate.max })
      }
    >
      <small className="font-bold uppercase tracking-wider text-[var(--primary)]">
        Estimativa inicial
      </small>
      <strong className="mt-2 block text-2xl">{label}</strong>
      <p className="mt-2 text-xs text-[var(--muted-fg)]">
        Valor sujeito à confirmação após avaliação.
      </p>
    </div>
  );
}

const QuoteSummaryBlock: BlockRenderer = ({ runtime }) => (
  <div className={cardClass}>
    <strong className="text-sm">Resumo do pedido</strong>
    <div className="mt-3 flex flex-col gap-2">
      {Object.entries(runtime.answers)
        .filter(([key]) => !["name", "phone", "email"].includes(key))
        .slice(0, 8)
        .map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 text-xs">
            <span className="capitalize text-[var(--muted-fg)]">
              {key.replaceAll("_", " ")}
            </span>
            <strong className="text-right">
              {Array.isArray(value) ? value.join(", ") : String(value)}
            </strong>
          </div>
        ))}
    </div>
  </div>
);

const BookingSummaryBlock: BlockRenderer = ({ project, runtime }) => {
  if (runtime.selectedDateRange?.start && runtime.selectedOfferIds[0]) {
    const unit = project.commercialConfig?.reservableUnits?.find(
      (item) => item.id === runtime.selectedOfferIds[0],
    );
    const total = unit
      ? calculateReservationTotal(
          unit,
          runtime.selectedDateRange.start,
          runtime.selectedDateRange.end,
        )
      : 0;
    return (
      <div className={cardClass}>
        <strong className="block text-sm">Resumo da reserva</strong>
        <p className="mt-2 text-xs text-[var(--muted-fg)]">
          {unit?.name} ·{" "}
          {reservationNights(
            runtime.selectedDateRange.start,
            runtime.selectedDateRange.end,
          )}{" "}
          diária(s)
        </p>
        <strong className="mt-3 block text-lg text-[var(--primary)]">
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: unit?.currency || "BRL",
          }).format(total)}
        </strong>
      </div>
    );
  }
  return (
    <div className={cardClass}>
      <strong className="block text-sm">Resumo do agendamento</strong>
      <p className="mt-2 text-xs text-[var(--muted-fg)]">
        {runtime.selectedSlot
          ? new Date(runtime.selectedSlot).toLocaleString("pt-BR")
          : "Escolha um horário para continuar."}
      </p>
    </div>
  );
};

const LocationSelectorBlock: BlockRenderer = ({
  project,
  runtime,
  setRuntime,
  emit,
}) => {
  return (
    <LocationFinder
      project={project}
      runtime={runtime}
      setRuntime={setRuntime}
      emit={emit}
    />
  );
};

const RouteResultBlock: BlockRenderer = ({ runtime }) =>
  runtime.routeResult ? (
    <div className={cn(cardClass, "flex items-start gap-3")}>
      <span className="grid size-11 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]">
        <Route size={21} />
      </span>
      <span>
        <small className="font-bold uppercase tracking-wider text-[var(--primary)]">
          Destino recomendado
        </small>
        <strong className="mt-1 block text-lg">
          {runtime.routeResult.destination?.label || "Atendimento manual"}
        </strong>
        <p className="mt-1 text-xs text-[var(--muted-fg)]">
          {runtime.routeResult.reason}
        </p>
      </span>
    </div>
  ) : null;

const PolicyCardBlock: BlockRenderer = ({ block }) => {
  const parsed = parseBlockContent("policy_card", block.content);
  return (
    <div className={cardClass}>
      <strong className="text-sm">Política</strong>
      <p className="mt-2 text-xs leading-5 text-[var(--muted-fg)]">
        {parsed.success
          ? parsed.data.text
          : "Consulte as políticas do negócio."}
      </p>
    </div>
  );
};
const DepositCardBlock: BlockRenderer = ({ block, project, runtime }) => {
  const parsed = parseBlockContent("deposit_card", block.content);
  const total = Number(runtime.answers.reservation_total || 0);
  const percent = parsed.success ? parsed.data.percent : undefined;
  return (
    <div className={cardClass}>
      <strong className="text-sm">
        {parsed.success && parsed.data.external
          ? "Pagamento externo"
          : "Sinal da reserva"}
      </strong>
      <p className="mt-2 text-xs text-[var(--muted-fg)]">
        {percent && total
          ? `${percent}% · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((total * percent) / 100)}`
          : project.commercialConfig?.paymentUrl
            ? "O pagamento será concluído em um ambiente externo seguro."
            : "O negócio informará as condições após aprovar."}
      </p>
    </div>
  );
};

const passthrough: BlockRenderer = EmptyBlock;

export const blockRenderers: Record<ContentBlockType, BlockRenderer> = {
  text: TextBlock,
  image: ImageBlock,
  video: passthrough,
  choice_grid: passthrough,
  choice_list: passthrough,
  benefits: passthrough,
  testimonial: passthrough,
  form: passthrough,
  recommendation_card: passthrough,
  cta_group: passthrough,
  location_card: LocationCardBlock,
  product_cards: LegacyProductCardsBlock,
  schedule_slots: ScheduleSlotsBlock,
  media_upload: MediaUploadBlock,
  quantity_selector: QuantitySelectorBlock,
  price_estimate: PriceEstimateBlock,
  service_selector: ServiceSelectorBlock,
  resource_selector: ResourceSelectorBlock,
  calendar: CalendarBlock,
  date_range: DateRangeBlock,
  guest_selector: GuestSelectorBlock,
  availability_results: AvailabilityResultsBlock,
  reservable_unit_cards: ReservableUnitCardsBlock,
  catalog_categories: CatalogCategoriesBlock,
  catalog_item_cards: CatalogItemCardsBlock,
  cart_summary: CartSummaryBlock,
  fulfillment_selector: FulfillmentSelectorBlock,
  location_selector: LocationSelectorBlock,
  route_result: RouteResultBlock,
  policy_card: PolicyCardBlock,
  deposit_card: DepositCardBlock,
  booking_summary: BookingSummaryBlock,
  quote_summary: QuoteSummaryBlock,
};

export function BlockRendererView(props: BlockRendererProps) {
  const Renderer = blockRenderers[props.block.type];
  return <Renderer {...props} />;
}
