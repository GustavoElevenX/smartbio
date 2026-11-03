"use client";

import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { commercialNotificationEvents, notificationEventDetails } from "@/server/notifications/notification-events";
import type { NotificationPreference } from "@/types";

export function NotificationPreferences() {
  const [values, setValues] = useState<NotificationPreference[]>([]);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar as preferências.");
        return response.json();
      })
      .then((payload) => {
        const current = payload.data || [];
        setValues(commercialNotificationEvents.map((eventKey) => current.find((item: NotificationPreference) => item.eventKey === eventKey) || { id: eventKey, workspaceId: "", userId: "", eventKey, inApp: true, email: notificationEventDetails[eventKey].email !== false }));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Não foi possível carregar as preferências."))
      .finally(() => setBusy(false));
  }, []);

  async function save() {
    setBusy(true);
    setMessage(undefined);
    try {
      const preferences = values.map((item) => ({ ...item, email: notificationEventDetails[item.eventKey as keyof typeof notificationEventDetails]?.email === false ? false : item.email }));
      const response = await fetch("/api/notifications/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ preferences }) });
      if (!response.ok) throw new Error("Não foi possível salvar as preferências.");
      setMessage("Preferências salvas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as preferências.");
    } finally {
      setBusy(false);
    }
  }

  if (busy && !values.length) return <div role="status" className="flex min-h-56 items-center justify-center gap-2 text-sm font-semibold text-[#657487]"><Loader2 className="animate-spin" /> Carregando preferências…</div>;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-black tracking-[-.03em] text-[#07172f]">Preferências de notificação</h1>
      <p className="mt-2 text-sm leading-6 text-[#657487]">Escolha onde deseja receber cada tipo de aviso. O WhatsApp continua sendo uma ação manual.</p>
      {message ? <p role="status" className="mt-4 text-sm font-semibold text-[#536178]">{message}</p> : null}
      <div className="mt-6 overflow-hidden border border-[#dfe6ee] bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] bg-[#f1f5f9] px-4 py-3 text-xs font-extrabold text-[#536178]"><span>Tipo de aviso</span><span>Na Sobe</span><span>E-mail</span></div>
        {values.map((item) => {
          const detail = notificationEventDetails[item.eventKey as keyof typeof notificationEventDetails];
          const emailAvailable = detail?.email !== false;
          return (
            <div key={item.eventKey} className="grid min-h-16 grid-cols-[minmax(0,1fr)_72px_72px] items-center border-t border-[#e3e8ee] px-4 py-3">
              <span className="min-w-0 pr-3"><strong className="block text-sm text-[#07172f]">{detail?.label || item.eventKey}</strong><small className="mt-1 block leading-4 text-[#657487]">{detail?.description}</small></span>
              <Switch aria-label={`${detail?.label || item.eventKey} na Sobe`} checked={item.inApp} onCheckedChange={(inApp) => setValues((current) => current.map((value) => value.eventKey === item.eventKey ? { ...value, inApp } : value))} />
              <Switch aria-label={emailAvailable ? `${detail?.label || item.eventKey} por e-mail` : `${detail?.label || item.eventKey}: disponível apenas na Sobe`} disabled={!emailAvailable} checked={emailAvailable && item.email} onCheckedChange={(email) => setValues((current) => current.map((value) => value.eventKey === item.eventKey ? { ...value, email } : value))} />
            </div>
          );
        })}
      </div>
      <Button className="mt-5" disabled={busy} onClick={() => void save()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar preferências</Button>
    </div>
  );
}
