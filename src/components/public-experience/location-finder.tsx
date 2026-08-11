"use client";

import { LoaderCircle, LocateFixed, MapPin, MessageCircle, Search } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { JourneyRuntimeState, Project, RoutingDestination } from "@/types";

interface PublicLocationResult {
  id: string;
  name: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  distanceKm?: number;
  isOpen?: boolean;
  destination?: RoutingDestination;
}

interface RoutingPayload {
  ok?: boolean;
  data?: {
    recommended?: PublicLocationResult;
    alternatives: PublicLocationResult[];
    fallbackReason?: string;
    method: "geolocation" | "postal_code" | "city";
  };
  error?: { message?: string };
}

const cardClass =
  "rounded-[var(--card-radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]";

function whatsappUrl(destination: RoutingDestination, location: string) {
  const phone = String(destination.value || "").replace(/\D/g, "");
  const template = destination.message || "Olá! A Virou indicou a unidade {{location}}. Quero continuar meu atendimento.";
  const message = encodeURIComponent(template.replaceAll("{{location}}", location));
  return `https://wa.me/${phone}?text=${message}`;
}

export function LocationFinder({
  project,
  runtime,
  setRuntime,
  emit,
}: {
  project: Project;
  runtime: JourneyRuntimeState;
  setRuntime: React.Dispatch<React.SetStateAction<JourneyRuntimeState>>;
  emit: (name: "route_resolved" | "whatsapp_clicked", metadata?: Record<string, unknown>) => void;
}) {
  const [mode, setMode] = useState<"options" | "postal" | "area" | "manual">("options");
  const [postalCode, setPostalCode] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RoutingPayload["data"]>();
  const manualLocations = (project.commercialConfig?.locations || []).filter(
    (location) => location.isActive,
  );

  function select(location: PublicLocationResult) {
    setRuntime((current) => ({
      ...current,
      selectedLocationId: location.id,
      answers: {
        ...current.answers,
        location: location.name,
        locationId: location.id,
      },
      routeResult: {
        destination: location.destination,
        fallback: !location.destination,
        reason: location.distanceKm == null
          ? "Unidade escolhida manualmente."
          : `${location.distanceKm.toFixed(1)} km de distância aproximada.`,
      },
    }));
  }

  async function resolve(input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/routing/nearest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          fulfillment: runtime.cart.fulfillment || "in_person",
          ...input,
        }),
      });
      const payload = (await response.json()) as RoutingPayload;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message || "Não foi possível localizar uma unidade.");
      }
      setResult(payload.data);
      if (payload.data.recommended) select(payload.data.recommended);
      emit("route_resolved", {
        locationId: payload.data.recommended?.id,
        distanceKm: payload.data.recommended?.distanceKm == null
          ? undefined
          : Math.round(payload.data.recommended.distanceKm),
        method: payload.data.method,
        fallbackReason: payload.data.fallbackReason,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível localizar uma unidade.");
      setMode(input.postalCode ? "area" : "manual");
    } finally {
      setBusy(false);
    }
  }

  function useLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Seu navegador não oferece localização. Informe o CEP ou escolha uma unidade.");
      setMode("postal");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setBusy(false);
        setError("Localização não autorizada. Você pode informar o CEP, bairro e cidade ou escolher manualmente.");
        setMode("postal");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }

  const selected = result?.recommended || result?.alternatives.find(
    (location) => location.id === runtime.selectedLocationId,
  );

  return (
    <section className={cn(cardClass, "grid gap-4")}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--muted)] text-[var(--primary)]">
          <MapPin size={20} />
        </span>
        <div>
          <strong className="block text-base">Encontrar a melhor unidade</strong>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">
            Usaremos sua localização apenas para encontrar a unidade mais adequada nesta consulta.
          </p>
        </div>
      </div>

      {mode === "options" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={useLocation} disabled={busy} className="min-h-12 rounded-[var(--button-radius)] bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-fg)]">
            {busy ? <LoaderCircle className="mr-2 inline animate-spin" size={16} /> : <LocateFixed className="mr-2 inline" size={16} />}
            Usar minha localização
          </button>
          <button type="button" onClick={() => setMode("postal")} className="min-h-12 rounded-[var(--button-radius)] border border-[var(--border)] px-4 text-sm font-bold">Informar CEP</button>
          <button type="button" onClick={() => setMode("area")} className="min-h-12 rounded-[var(--button-radius)] border border-[var(--border)] px-4 text-sm font-bold">Bairro e cidade</button>
          <button type="button" onClick={() => setMode("manual")} className="min-h-12 rounded-[var(--button-radius)] border border-[var(--border)] px-4 text-sm font-bold">Escolher manualmente</button>
        </div>
      ) : null}

      {mode === "postal" ? (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void resolve({ postalCode }); }}>
          <input aria-label="CEP" inputMode="numeric" required pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-[var(--input-radius)] border border-[var(--border)] bg-transparent px-3 text-sm" />
          <button disabled={busy} className="grid min-h-12 min-w-12 place-items-center rounded-[var(--button-radius)] bg-[var(--primary)] text-[var(--primary-fg)]" aria-label="Buscar pelo CEP">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}</button>
        </form>
      ) : null}

      {mode === "area" ? (
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void resolve({ neighborhood: neighborhood || undefined, city }); }}>
          <input aria-label="Bairro" placeholder="Bairro" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="min-h-12 rounded-[var(--input-radius)] border border-[var(--border)] bg-transparent px-3 text-sm" />
          <input aria-label="Cidade" required placeholder="Cidade" value={city} onChange={(event) => setCity(event.target.value)} className="min-h-12 rounded-[var(--input-radius)] border border-[var(--border)] bg-transparent px-3 text-sm" />
          <button disabled={busy} className="min-h-12 rounded-[var(--button-radius)] bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-fg)]">Buscar</button>
        </form>
      ) : null}

      {mode === "manual" ? (
        <div className="grid gap-2">
          {manualLocations.map((location) => (
            <button key={location.id} type="button" onClick={() => select({ id: location.id, name: location.name, address: [location.addressLine, location.city].filter(Boolean).join(", "), destination: project.commercialConfig?.routingDestinations?.find((item) => item.id === location.routingDestinationId) })} className="rounded-[var(--input-radius)] border border-[var(--border)] p-3 text-left text-sm">
              <strong className="block">{location.name}</strong>
              <span className="text-xs text-[var(--muted-fg)]">{[location.neighborhood, location.city].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {!manualLocations.length ? <p className="text-xs text-[var(--muted-fg)]">Nenhuma unidade pública disponível. O atendimento seguirá para o destino padrão.</p> : null}
        </div>
      ) : null}

      {error ? <p role="alert" className="text-xs font-semibold text-[var(--destructive)]">{error}</p> : null}

      {selected ? (
        <div className="rounded-[var(--input-radius)] bg-[var(--muted)] p-4">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--primary)]">Unidade indicada</span>
          <strong className="mt-1 block text-lg">{selected.name}</strong>
          <p className="mt-1 text-xs text-[var(--muted-fg)]">{selected.address}</p>
          {selected.distanceKm != null ? <p className="mt-2 text-xs font-bold">Distância aproximada: {selected.distanceKm.toFixed(1)} km · {selected.isOpen ? "aberta agora" : "fechada agora"}</p> : null}
          {selected.destination?.type === "whatsapp" && selected.destination.value ? (
            <a href={whatsappUrl(selected.destination, selected.name)} target="_blank" rel="noreferrer" onClick={() => emit("whatsapp_clicked", { locationId: selected.id })} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[var(--button-radius)] bg-[var(--primary)] px-4 text-sm font-bold text-[var(--primary-fg)]"><MessageCircle size={17} />Continuar no WhatsApp</a>
          ) : null}
        </div>
      ) : null}

      {mode !== "options" ? <button type="button" onClick={() => { setMode("options"); setError(""); }} className="justify-self-start text-xs font-bold text-[var(--primary)]">Ver outras opções</button> : null}
    </section>
  );
}
