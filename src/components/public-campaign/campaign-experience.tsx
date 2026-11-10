"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Project } from "@/types";
import type { ActivationDynamicSurface } from "@/features/activations/dynamic-home-contract";
import type { PublicActivation } from "@/features/activations/activation.types";
import { ConversionLauncher, useConversionLauncher } from "@/components/public-presence/conversion-launcher";
import { ActivationRuntimeProvider, useActivationRuntime } from "@/components/public-activations/activation-runtime-provider";

function CampaignAction({ activation, label, preview }: { activation: PublicActivation; label: string; preview: boolean }) {
  const launcher = useConversionLauncher();
  const runtime = useActivationRuntime();
  return <button type="button" onClick={() => {
    if (preview) launcher.open({ goalId: activation.conversionGoalId, campaignKey: activation.activationKey });
    else runtime?.startActivation(activation.id);
  }} className="focus-ring inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-[var(--presence-button-radius)] bg-[var(--presence-primary)] px-6 py-3 text-center text-sm font-extrabold text-white shadow-lg shadow-black/10 transition hover:opacity-90">
    {label}<ArrowRight size={18} aria-hidden="true" />
  </button>;
}

export function CampaignExperience({ project, surface, activation, preview = false }: {
  project: Project; surface: ActivationDynamicSurface; activation: PublicActivation; preview?: boolean;
}) {
  const colors = project.designSystem.colors;
  const shape = project.designSystem.shape;
  const style = {
    "--presence-primary": colors.primary,
    "--presence-bg": colors.background,
    "--presence-fg": colors.foreground,
    "--presence-muted": colors.mutedForeground,
    "--presence-button-radius": `${shape.buttonRadius}px`,
    background: colors.background,
    color: colors.foreground,
    fontFamily: `${project.designSystem.typography.bodyFont}, ui-sans-serif, system-ui, sans-serif`,
  } as CSSProperties;
  const logo = project.brand.logoDataUrl || project.brand.darkLogoDataUrl || project.brand.lightLogoDataUrl;
  const goal = project.conversionGoals?.find((item) => item.id === surface.conversionGoalId && item.isActive);
  const offer = activation.offer?.offerType === "no_discount" ? undefined : activation.offer;
  const conditions = surface.sections.find((item) => item.kind === "conditions")?.content.text;
  const conditionsText = typeof conditions === "string" ? conditions : activation.offer?.description;
  const content = <div className="min-h-screen bg-[var(--presence-bg)] text-[var(--presence-fg)]" style={style}>
    <header className="border-b border-current/10">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        {logo ? <Image src={logo} alt={`Logo de ${project.name}`} width={180} height={48} unoptimized={logo.startsWith("data:")} className="h-10 w-auto max-w-[170px] object-contain" /> : <strong className="text-xl font-black">{project.name}</strong>}
        {!preview ? <Link href={`/${project.slug}`} className="focus-ring min-h-11 rounded-xl px-3 py-3 text-sm font-bold">Início</Link> : <span className="text-xs font-bold uppercase tracking-widest">Prévia</span>}
      </div>
    </header>
    <main className="mx-auto grid min-h-[min(740px,calc(100dvh-145px))] max-w-6xl items-center gap-12 px-5 py-14 sm:px-8 md:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)] md:py-20">
      <section className="max-w-3xl">
        <p className="text-sm font-extrabold uppercase tracking-[.13em] text-[var(--presence-primary)]">{project.name} · Campanha</p>
        <h1 className="mt-5 text-4xl font-black leading-[1.08] tracking-[-.05em] sm:text-5xl lg:text-6xl" style={{ fontFamily: `${project.designSystem.typography.headingFont}, ui-sans-serif, sans-serif` }}>{surface.title}</h1>
        {surface.message ? <p className="mt-6 max-w-2xl text-lg leading-8">{surface.message}</p> : null}
        {offer ? <p className="mt-6 inline-flex rounded-full border border-current/20 px-4 py-2 text-sm font-extrabold">{offer.label}</p> : null}
        <div className="mt-8"><CampaignAction activation={activation} label={goal?.name || "Continuar"} preview={preview} /></div>
      </section>
      <aside className="rounded-[28px] border border-current/10 bg-white/80 p-6 shadow-xl shadow-black/5 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[.13em] text-[var(--presence-primary)]">Como continuar</p>
        <h2 className="mt-4 text-2xl font-extrabold">{goal?.name || "Fale com a equipe"}</h2>
        {conditionsText ? <div className="mt-5 border-t border-current/10 pt-5"><strong className="text-sm">Condições</strong><p className="mt-2 text-sm leading-6">{conditionsText}</p></div> : null}
        {activation.endsAt ? <p className="mt-5 text-xs text-[var(--presence-muted)]">Válida até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: activation.timezone }).format(new Date(activation.endsAt))}.</p> : null}
      </aside>
    </main>
    <footer className="border-t border-current/10 px-5 py-6 text-center text-xs text-[var(--presence-muted)]">Feito com Sobe · <Link href="/" className="underline">Conhecer a Sobe</Link></footer>
  </div>;
  return <ConversionLauncher projectSlug={project.slug} projectId={project.id} previewProject={preview ? project : undefined}>
    {preview ? content : <ActivationRuntimeProvider projectId={project.id} activations={[{ ...activation, placements: [] }]}>{content}</ActivationRuntimeProvider>}
  </ConversionLauncher>;
}
