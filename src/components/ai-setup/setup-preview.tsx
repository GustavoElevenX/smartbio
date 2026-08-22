"use client";

import { Eye, Layers3, Smartphone } from "lucide-react";
import { ExperienceCanvas } from "@/components/public-experience/public-experience";
import { SetupProgress } from "@/components/ai-setup/setup-progress";
import { SetupRequirements } from "@/components/ai-setup/setup-requirements";
import type { AISetupSession, BrandIdentity } from "@/features/ai-setup/ai-setup.schema";
import type { Project } from "@/types";

export default function SetupPreview({ session, businessName, description, brandIdentity, logoPreviewUrl }: { session?: AISetupSession | null; businessName: string; description: string; brandIdentity?: BrandIdentity; logoPreviewUrl?: string }) {
  const project = session?.projectDraft as Project | undefined;
  const palette = brandIdentity?.activePalette;
  return (
    <aside className="h-full border-l border-[#e7e5ed] bg-[#f7fbff] p-5 xl:p-6">
      <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#0054fc] shadow-sm"><Eye size={14} /> Prévia adaptativa</span><Smartphone size={17} className="text-[#8b8995]" /></div>
      {project ? <div className="mx-auto mt-5 h-[390px] max-w-[230px] overflow-hidden rounded-[30px] border-[5px] border-[#25242a] bg-white shadow-[0_24px_55px_rgba(35,29,72,.16)]"><ExperienceCanvas project={project} preview /></div> : <div className="mx-auto mt-6 max-w-[240px] rounded-[28px] border-[5px] border-[#25242a] bg-white p-2 shadow-[0_24px_55px_rgba(35,29,72,.14)]"><div className="min-h-[350px] rounded-[20px] p-5 transition-colors duration-300" style={{ background: palette?.background || "linear-gradient(155deg,#f7fbff 0%,#fff 52%,#f7fbff 100%)", color: palette?.foreground || "#07172f" }}>{logoPreviewUrl ? <div className="flex h-12 max-w-28 items-center"><img src={logoPreviewUrl} alt="Logo na prévia" className="max-h-12 max-w-full object-contain" /></div> : <span className="grid size-10 place-items-center rounded-xl text-xs font-black" style={{ backgroundColor: palette?.primary || "#0054fc", color: palette?.primaryForeground || "#fff" }}>{(businessName || "SB").slice(0, 2).toUpperCase()}</span>}<p className="mt-12 text-[9px] font-black uppercase tracking-[.15em]" style={{ color: palette?.primary || "#0054fc" }}>Sua experiência</p><h3 className="mt-2 text-2xl font-extrabold leading-[1.08] tracking-[-.04em]">{businessName ? `Como podemos ajudar você hoje?` : "A jornada nasce da conversa."}</h3><p className="mt-3 text-xs leading-5" style={{ color: palette?.mutedForeground || "#73717e" }}>{description ? `${description.slice(0, 105)}${description.length > 105 ? "…" : ""}` : "Descreva o negócio para descobrir os caminhos comerciais e as perguntas certas."}</p><div className="mt-5 grid gap-2">{["Objetivo do visitante", "Próximo passo", "Dados necessários"].map((item) => <div key={item} className="rounded-xl border p-3 text-[11px] font-bold" style={{ backgroundColor: palette?.surface || "#fff", borderColor: palette?.border || "#eaf3ff", color: palette?.foreground || "#5b5767" }}>{item}</div>)}</div></div></div>}
      <div className="mt-6 rounded-[18px] border border-[#e4e2eb] bg-white p-4"><SetupProgress session={session} /></div>
      <div className="mt-4"><h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#56545f]"><Layers3 size={15} className="text-[#0054fc]" /> Informações para deixar tudo funcionando</h3><SetupRequirements requirements={session?.missingRequirements || []} /></div>
    </aside>
  );
}
