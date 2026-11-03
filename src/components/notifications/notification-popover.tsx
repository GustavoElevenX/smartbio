"use client";

import Link from "next/link";
import { BellRing, RotateCcw, Settings } from "lucide-react";
import { NotificationItem } from "@/components/notifications/notification-item";
import type { Notification } from "@/types";

export function NotificationPopover({ items, loading, error, onRead, onReadAll, onRetry }: { items: Notification[]; loading: boolean; error?: string; onRead: (id: string) => void; onReadAll: () => void; onRetry: () => void }) {
  const unread = items.filter((item) => !item.readAt).length;
  return (
    <div className="w-[min(410px,calc(100vw-24px))] bg-white">
      <div className="flex items-center justify-between border-b border-[#e3e8ee] px-4 py-3.5">
        <div>
          <strong className="block text-sm text-[#07172f]">Notificações</strong>
          <span className="mt-0.5 block text-[11px] font-semibold text-[#6c7a8b]">{unread ? `${unread} ${unread === 1 ? "nova" : "novas"}` : "Tudo em dia"}</span>
        </div>
        {unread ? <button type="button" className="focus-ring min-h-11 px-2 text-xs font-bold text-[#0054fc]" onClick={onReadAll}>Marcar todas como lidas</button> : null}
      </div>
      <div className="scrollbar-thin flex max-h-[460px] flex-col gap-2 overflow-y-auto p-3" aria-live="polite">
        {loading && !items.length ? (
          <div role="status" className="space-y-2" aria-label="Carregando notificações">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse bg-[#eef2f7]" />)}
          </div>
        ) : error && !items.length ? (
          <div role="alert" className="px-5 py-8 text-center">
            <strong className="block text-sm text-[#07172f]">Não foi possível carregar</strong>
            <p className="mt-2 text-xs leading-5 text-[#657487]">{error}</p>
            <button type="button" onClick={onRetry} className="focus-ring mt-4 inline-flex min-h-11 items-center gap-2 px-3 text-xs font-bold text-[#0054fc]"><RotateCcw size={14} aria-hidden="true" /> Tentar novamente</button>
          </div>
        ) : items.length ? (
          items.slice(0, 8).map((item) => <NotificationItem key={item.id} item={item} compact onRead={onRead} />)
        ) : (
          <div className="px-6 py-10 text-center">
            <BellRing className="mx-auto text-[#8b9aac]" aria-hidden="true" />
            <strong className="mt-4 block text-sm text-[#07172f]">Nenhuma novidade por enquanto</strong>
            <p className="mt-2 text-xs leading-5 text-[#657487]">Publicações, visitas, oportunidades e avisos do plano aparecerão aqui.</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 border-t border-[#e3e8ee]">
        <Link href="/app/notifications" className="focus-ring flex min-h-11 items-center justify-center text-xs font-bold text-[#0054fc] hover:bg-[#f7fbff]">Ver todas</Link>
        <Link href="/app/settings/notifications" className="focus-ring flex min-h-11 items-center justify-center gap-1.5 border-l border-[#e3e8ee] text-xs font-bold text-[#536178] hover:bg-[#f7f8fa]"><Settings size={14} aria-hidden="true" /> Preferências</Link>
      </div>
    </div>
  );
}
