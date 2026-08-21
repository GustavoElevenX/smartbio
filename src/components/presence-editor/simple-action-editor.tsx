"use client";

import type { PresenceAction, PresencePage } from "@/features/presence/presence.types";
import type { Project } from "@/types";

type HumanAction = "order" | "products" | "quote" | "schedule" | "questions" | "whatsapp" | "page" | "url";

const humanOptions: Array<[HumanAction, string]> = [
  ["order", "Começar um pedido"],
  ["products", "Ver produtos"],
  ["quote", "Pedir orçamento"],
  ["schedule", "Agendar"],
  ["questions", "Responder algumas perguntas"],
  ["whatsapp", "Abrir WhatsApp"],
  ["page", "Ir para outra página"],
  ["url", "Abrir um link"],
];

function currentKind(project: Project, action?: PresenceAction): HumanAction {
  if (action?.type === "open_whatsapp") return "whatsapp";
  if (action?.type === "go_to_presence_page") return "page";
  if (action?.type === "open_url") return "url";
  if (action?.label.toLocaleLowerCase("pt-BR").includes("ver produto")) return "products";
  const goal = project.conversionGoals?.find((item) => item.id === action?.conversionGoalId);
  if (goal?.kind === "buy") return action?.label.toLocaleLowerCase("pt-BR").includes("ver") ? "products" : "order";
  if (goal?.kind === "request_quote") return "quote";
  if (goal?.kind === "schedule" || goal?.kind === "reserve") return "schedule";
  return "questions";
}

function goalFor(project: Project, kind: HumanAction) {
  const goals = (project.conversionGoals || []).filter((goal) => goal.isActive);
  if (kind === "order" || kind === "products") return goals.find((goal) => goal.kind === "buy") || goals[0];
  if (kind === "quote") return goals.find((goal) => goal.kind === "request_quote") || goals[0];
  if (kind === "schedule") return goals.find((goal) => goal.kind === "schedule" || goal.kind === "reserve") || goals[0];
  return goals.find((goal) => goal.kind === "contact" || goal.kind === "learn") || goals[0];
}

export function SimpleActionEditor({ project, page, action, onChange, labelText = "Ação" }: { project: Project; page: PresencePage; action?: PresenceAction; onChange(action?: PresenceAction): void; labelText?: string }) {
  const kind = currentKind(project, action);
  const input = "mt-1 min-h-11 w-full rounded-xl border border-[#d7e1ec] bg-white px-3 text-sm outline-none focus:border-[#0054fc] focus:ring-4 focus:ring-[#0054fc]/10";
  function choose(next: HumanAction) {
    const label = humanOptions.find(([value]) => value === next)?.[1] || "Continuar";
    if (next === "whatsapp") return onChange({ type: "open_whatsapp", label, whatsappPhone: project.phone, style: "primary" });
    if (next === "page") return onChange({ type: "go_to_presence_page", label, pageId: (project.presence?.pages || []).find((item) => item.id !== page.id)?.id || page.id, style: "primary" });
    if (next === "url") return onChange({ type: "open_url", label, url: "https://", style: "primary" });
    const goal = goalFor(project, next);
    onChange({ type: "start_conversion_goal", label: next === "products" ? "Ver produtos" : goal?.name || label, conversionGoalId: goal?.id, style: "primary" });
  }
  return <fieldset className="border border-[#dfe6ee] p-4" style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)" }}>
    <legend className="px-1 text-xs font-extrabold text-[#536178]">{labelText}</legend>
    <label className="block text-sm font-extrabold text-[#07172f]">Quando alguém clicar neste botão, o que deve acontecer?
      <select className={input} value={kind} onChange={(event) => choose(event.target.value as HumanAction)}>{humanOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </label>
    {action ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Texto do botão<input className={input} value={action.label} onChange={(event) => onChange({ ...action, label: event.target.value })} /></label> : <button type="button" onClick={() => choose("questions")} className="mt-3 min-h-10 text-xs font-extrabold text-[#0054fc]">Adicionar ação</button>}
    {action?.type === "start_conversion_goal" ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Caminho escolhido<select className={input} value={action.conversionGoalId || ""} onChange={(event) => onChange({ ...action, conversionGoalId: event.target.value || undefined })}><option value="">Escolha uma ação existente</option>{project.conversionGoals?.filter((goal) => goal.isActive).map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label> : null}
    {action?.type === "open_whatsapp" ? <><label className="mt-4 block text-xs font-extrabold text-[#536178]">Número do WhatsApp<input className={input} value={action.whatsappPhone || ""} onChange={(event) => onChange({ ...action, whatsappPhone: event.target.value })} /></label><label className="mt-4 block text-xs font-extrabold text-[#536178]">Mensagem inicial (opcional)<textarea className={`${input} min-h-24 py-2`} value={action.whatsappMessage || ""} onChange={(event) => onChange({ ...action, whatsappMessage: event.target.value || undefined })} /></label></> : null}
    {action?.type === "go_to_presence_page" ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Página<select className={input} value={action.pageId || ""} onChange={(event) => onChange({ ...action, pageId: event.target.value })}>{project.presence?.pages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
    {action?.type === "open_url" ? <label className="mt-4 block text-xs font-extrabold text-[#536178]">Link<input className={input} type="url" value={action.url || ""} onChange={(event) => onChange({ ...action, url: event.target.value })} placeholder="https://" /></label> : null}
    {action ? <button type="button" onClick={() => onChange(undefined)} className="mt-4 min-h-10 text-xs font-bold text-[#a43b3b]">Remover ação</button> : null}
  </fieldset>;
}
