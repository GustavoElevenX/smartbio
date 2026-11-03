"use client";

import { BellRing, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import type { Notification } from "@/types";

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(undefined);
      const response = await fetch(`/api/notifications?filter=${filter}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível buscar suas notificações.");
      const payload = await response.json() as { data?: Notification[] };
      setItems(payload.data || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function read(ids?: string[]) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : { all: true }) });
    if (!response.ok) {
      setError("Não foi possível marcar como lida. Tente novamente.");
      return;
    }
    await load();
  }

  const unread = items.filter((item) => !item.readAt).length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe6ee] pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-[-.03em] text-[#07172f]">Notificações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#657487]">Acompanhe publicações, visitas, oportunidades e avisos importantes do seu plano.</p>
        </div>
        <Button size="sm" variant="secondary" disabled={!unread || loading} onClick={() => void read()}>Marcar todas como lidas</Button>
      </div>

      <div className="mt-5 flex gap-2" role="group" aria-label="Filtrar notificações">
        <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Todas</Button>
        <Button size="sm" variant={filter === "unread" ? "primary" : "secondary"} aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>Não lidas</Button>
      </div>

      <div className="mt-5 flex flex-col gap-3" aria-live="polite">
        {loading && !items.length ? (
          <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm font-semibold text-[#657487]"><Loader2 className="animate-spin" size={18} /> Carregando notificações…</div>
        ) : error ? (
          <div role="alert" className="border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <strong className="block">Não foi possível atualizar esta lista</strong>
            <p className="mt-1">{error}</p>
            <Button className="mt-4" size="sm" variant="secondary" onClick={() => void load()}><RotateCcw size={14} /> Tentar novamente</Button>
          </div>
        ) : items.length ? (
          items.map((item) => <NotificationItem key={item.id} item={item} onRead={(id) => void read([id])} />)
        ) : (
          <div className="border border-[#dfe6ee] bg-white px-6 py-14 text-center">
            <BellRing className="mx-auto text-[#8b9aac]" aria-hidden="true" />
            <strong className="mt-4 block text-base text-[#07172f]">{filter === "unread" ? "Você leu todas as notificações" : "Nenhuma novidade por enquanto"}</strong>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#657487]">Novas visitas aparecem por marcos para manter esta central útil, sem avisar a cada acesso.</p>
          </div>
        )}
      </div>
    </div>
  );
}
