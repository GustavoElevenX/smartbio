"use client";

import Link from "next/link";
import { Activity, BellRing, Check, CreditCard, MessageCircle, Rocket, UserPlus } from "lucide-react";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/features/whatsapp/whatsapp";
import type { Notification } from "@/types";

function presentation(type: string) {
  if (type === "lead.created") return { icon: UserPlus, tone: "bg-[#e9f8f5] text-[#087b6c]", action: "Ver oportunidade" };
  if (type === "project.published") return { icon: Rocket, tone: "bg-[#eaf3ff] text-[#0054fc]", action: "Ver página" };
  if (type.startsWith("traffic.")) return { icon: Activity, tone: "bg-[#e9fbf9] text-[#087b6c]", action: "Ver resultados" };
  if (type.startsWith("subscription.") || type.startsWith("trial.")) return { icon: CreditCard, tone: "bg-[#fff4dc] text-[#8a5700]", action: "Ver plano" };
  return { icon: BellRing, tone: "bg-[#eef2f7] text-[#536178]", action: "Abrir detalhes" };
}

function formattedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function NotificationItem({ item, compact, onRead }: { item: Notification; compact?: boolean; onRead?: (id: string) => void }) {
  const phone = typeof item.metadata.whatsapp === "string"
    ? item.metadata.whatsapp
    : typeof item.metadata.phone === "string"
      ? item.metadata.phone
      : "";
  const message = buildWhatsAppMessage({
    greeting: typeof item.metadata.visitorName === "string" ? `Olá, ${item.metadata.visitorName}! Recebemos sua solicitação pelo nosso link.` : undefined,
    interest: typeof item.metadata.interest === "string" ? item.metadata.interest : undefined,
    answers: Object.fromEntries([
      ["serviço", item.metadata.service],
      ["unidade", item.metadata.location],
      ["bairro", item.metadata.neighborhood],
    ].filter((entry): entry is [string, string] => typeof entry[1] === "string")),
  });
  const appearance = presentation(item.type);
  const Icon = appearance.icon;

  return (
    <article className={`border bg-white ${compact ? "p-3" : "p-4"} ${item.readAt ? "border-[#e3e8ee]" : "border-[#9fc3ff] bg-[#f7fbff]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center ${appearance.tone}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <strong className="min-w-0 flex-1 text-sm leading-5 text-[#07172f]">{item.title}</strong>
            {!item.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0054fc]" aria-label="Não lida" /> : null}
          </div>
          <p className={`mt-1 break-words text-xs leading-5 text-[#59697c] ${compact ? "line-clamp-2" : ""}`}>{item.body}</p>
          <time className="mt-2 block text-[10px] font-semibold tabular-nums text-[#7f8c9c]" dateTime={item.createdAt}>
            {formattedDate(item.createdAt)}
          </time>
        </div>
        {!item.readAt && onRead ? (
          <button type="button" title="Marcar como lida" aria-label={`Marcar “${item.title}” como lida`} onClick={() => onRead(item.id)} className="focus-ring grid size-11 shrink-0 place-items-center text-[#0054fc] hover:bg-[#eaf3ff]">
            <Check size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {item.actionUrl || phone ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pl-12">
          {item.actionUrl ? (
            <Link href={item.actionUrl} onClick={() => { if (!item.readAt) onRead?.(item.id); }} className="focus-ring inline-flex min-h-11 items-center text-xs font-bold text-[#0054fc] underline decoration-[#9fc3ff] underline-offset-4 hover:text-[#0048d9]">
              {appearance.action}
            </Link>
          ) : null}
          {phone ? (
            <a href={buildWhatsAppUrl(phone, message)} target="_blank" rel="noreferrer" className="focus-ring inline-flex min-h-11 items-center gap-1 text-xs font-bold text-emerald-700 underline decoration-emerald-200 underline-offset-4">
              <MessageCircle size={13} aria-hidden="true" /> Abrir WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
