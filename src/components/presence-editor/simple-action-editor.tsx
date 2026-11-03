"use client";

import type { PresenceAction, PresencePage } from "@/features/presence/presence.types";
import type { Project } from "@/types";
import { ExternalLinkField } from "@/components/presence-editor/external-link-field";
import { isValidWhatsAppPhone } from "@/features/whatsapp/whatsapp-destination";
import { primaryWhatsAppDestination, projectWhatsAppNumbers } from "@/features/whatsapp/project-whatsapp-numbers";

type DirectAction = "whatsapp" | "page" | "url";

function currentChoice(action?: PresenceAction) {
  if (action?.type === "start_conversion_goal") return `goal:${action.conversionGoalId || ""}`;
  if (action?.type === "open_whatsapp") return "direct:whatsapp";
  if (action?.type === "go_to_presence_page") return "direct:page";
  if (action?.type === "open_url") return "direct:url";
  return "";
}

export function SimpleActionEditor({ project, page, action, onChange, labelText = "Ação" }: { project: Project; page: PresencePage; action?: PresenceAction; onChange(action?: PresenceAction): void; labelText?: string }) {
  const goals = (project.conversionGoals || []).filter((goal) => goal.isActive);
  const whatsappNumbers = projectWhatsAppNumbers(project).filter((item) => isValidWhatsAppPhone(item.value));
  const input = "mt-1 min-h-11 w-full rounded-xl border border-[#d7e1ec] bg-white px-3 text-sm outline-none focus:border-[#0054fc] focus:ring-4 focus:ring-[#0054fc]/10";
  function choose(next: string) {
    if (next.startsWith("goal:")) {
      const goal = goals.find((item) => item.id === next.slice(5));
      return onChange({ type: "start_conversion_goal", label: goal?.name || "Continuar", conversionGoalId: goal?.id, style: "primary" });
    }
    const direct = next.slice(7) as DirectAction;
    if (direct === "whatsapp") {
      const destination = primaryWhatsAppDestination(project);
      return onChange({ type: "open_whatsapp", label: "Falar pelo WhatsApp", whatsappDestinationId: destination?.id, whatsappPhone: destination ? undefined : project.phone, style: "primary" });
    }
    if (direct === "page") return onChange({ type: "go_to_presence_page", label: "Ir para outra página", pageId: (project.presence?.pages || []).find((item) => item.id !== page.id)?.id || page.id, style: "primary" });
    if (direct === "url") return onChange({ type: "open_url", label: "Abrir link", style: "primary" });
  }
  return <fieldset className="border border-[#dfe6ee] p-4" style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" }}>
    <legend className="px-1 text-xs font-extrabold text-[#536178]">{labelText}</legend>
    <label className="block text-sm font-extrabold text-[#07172f]">O que deve acontecer quando alguém clicar aqui?
      <select className={input} value={currentChoice(action)} onChange={(event) => choose(event.target.value)}>
        <option value="">Escolha uma ação</option>
        {goals.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.name}</option>)}
        {whatsappNumbers.length ? <option value="direct:whatsapp">Falar pelo WhatsApp</option> : null}
        {(project.presence?.pages || []).length > 1 ? <option value="direct:page">Ir para outra página</option> : null}
        <option value="direct:url">Abrir link externo</option>
      </select>
    </label>
    {action ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Texto do botão<input className={input} value={action.label} onChange={(event) => onChange({ ...action, label: event.target.value })} /></label> : null}
    {action?.type === "open_whatsapp" ? <><label className="mt-4 block text-xs font-extrabold text-[#536178]">Número de destino<select className={input} value={action.whatsappDestinationId || "manual"} onChange={(event) => onChange({ ...action, whatsappDestinationId: event.target.value === "manual" ? undefined : event.target.value, whatsappPhone: event.target.value === "manual" ? action.whatsappPhone : undefined })}>{whatsappNumbers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.isDefault ? " · Principal" : ""}</option>)}<option value="manual">Outro número</option></select></label>{!action.whatsappDestinationId ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Número do WhatsApp<input className={input} type="tel" inputMode="tel" value={action.whatsappPhone || ""} onChange={(event) => onChange({ ...action, whatsappPhone: event.target.value })} /></label> : null}<label className="mt-4 block text-xs font-extrabold text-[#536178]">Mensagem inicial (opcional)<textarea className={`${input} min-h-24 py-2`} value={action.whatsappMessage || ""} onChange={(event) => onChange({ ...action, whatsappMessage: event.target.value || undefined })} /></label></> : null}
    {action?.type === "go_to_presence_page" ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Página<select className={input} value={action.pageId || ""} onChange={(event) => onChange({ ...action, pageId: event.target.value })}>{project.presence?.pages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    {action?.type === "open_url" ? <ExternalLinkField id={`external-link-${page.id}-${labelText.replaceAll(" ", "-").toLowerCase()}`} className="mt-4" value={action.url} onChange={(url) => onChange({ ...action, url })} /> : null}
    {action ? <button type="button" onClick={() => onChange(undefined)} className="mt-4 min-h-10 text-xs font-bold text-[#a43b3b]">Remover ação</button> : null}
  </fieldset>;
}
