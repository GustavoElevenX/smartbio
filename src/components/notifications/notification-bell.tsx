"use client";

import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NotificationPopover } from "@/components/notifications/notification-popover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Notification } from "@/types";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    try {
      setError(undefined);
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Tente atualizar novamente em alguns instantes.");
      const payload = await response.json() as { data?: Notification[] };
      setItems(payload.data || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar as notificações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function read(ids?: string[]) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : { all: true }) });
    if (!response.ok) {
      setError("A notificação não foi marcada como lida. Tente novamente.");
      return;
    }
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => !ids || ids.includes(item.id) ? { ...item, readAt: item.readAt || now } : item));
  }

  const unread = items.filter((item) => !item.readAt).length;
  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) void load(); }}>
      <PopoverTrigger asChild>
        <button className="focus-ring relative grid size-11 place-items-center rounded-xl border border-[#d7e1ec] bg-white text-[#536178] hover:border-[#9fc3ff] hover:bg-[#f7fbff] hover:text-[#0054fc]" aria-label={`Notificações${unread ? `, ${unread} não ${unread === 1 ? "lida" : "lidas"}` : ""}`} aria-expanded={open}>
          <Bell size={18} aria-hidden="true" />
          {unread ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#0054fc] px-1 text-[10px] font-black tabular-nums text-white">{Math.min(unread, 99)}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto overflow-hidden rounded-[16px] border-[#dfe6ee] p-0 shadow-[0_20px_60px_rgba(7,23,47,.18)]">
        <NotificationPopover items={items} loading={loading} error={error} onRead={(id) => void read([id])} onReadAll={() => void read()} onRetry={() => void load()} />
      </PopoverContent>
    </Popover>
  );
}
