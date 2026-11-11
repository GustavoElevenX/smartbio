"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Project } from "@/types";
import type { ActivationDynamicSurface } from "@/features/activations/dynamic-home-contract";
import type { PublicActivation } from "@/features/activations/activation.types";
import { campaignPresentation } from "@/features/activations/campaign-presentation";
import { ConversionLauncher, useConversionLauncher } from "@/components/public-presence/conversion-launcher";
import { ActivationRuntimeProvider, useActivationRuntime } from "@/components/public-activations/activation-runtime-provider";

function CampaignAction({ activation, label, preview }: { activation: PublicActivation; label: string; preview: boolean }) {
  const launcher = useConversionLauncher();
  const runtime = useActivationRuntime();
  return <button type="button" onClick={() => {
    if (preview) launcher.open({ goalId: activation.conversionGoalId, campaignKey: activation.activationKey,
      activationVersion: activation.publishedVersion, offerId: activation.offer?.id, offerLabel: activation.offer?.label });
    else runtime?.startActivation(activation.id);
  }} className="focus-ring inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-[var(--campaign-button-radius)] bg-[var(--campaign-primary)] px-6 py-3 text-center text-sm font-extrabold text-[var(--campaign-primary-fg)] transition hover:opacity-90">
    {label}<ArrowRight size={18} aria-hidden="true" />
  </button>;
}

export function CampaignExperience({ project, surface, activation, preview = false }: {
  project: Project; surface: ActivationDynamicSurface; activation: PublicActivation; preview?: boolean;
}) {
  const colors = project.designSystem.colors;
  const content = campaignPresentation(surface, activation);
  const goal = project.conversionGoals?.find((item) => item.id === surface.conversionGoalId && item.isActive);
  const logo = project.brand.logoDataUrl || project.brand.darkLogoDataUrl || project.brand.lightLogoDataUrl;
  const standardUrl = `/${project.slug}?view=standard`;
  const style = {
    "--campaign-primary": colors.primary,
    "--campaign-primary-fg": colors.primaryForeground,
    "--campaign-bg": colors.background,
    "--campaign-surface": colors.surface,
    "--campaign-fg": colors.foreground,
    "--campaign-muted": colors.mutedForeground,
    "--campaign-border": colors.border,
    "--campaign-button-radius": `${project.designSystem.shape.buttonRadius}px`,
    fontFamily: `${project.designSystem.typography.bodyFont}, ui-sans-serif, system-ui, sans-serif`,
  } as CSSProperties;
  const shell = <div className="min-h-screen bg-[var(--campaign-bg)] text-[var(--campaign-fg)]" style={style}>
    <header className="border-b border-[var(--campaign-border)]">
      <div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        {logo ? <Image src={logo} alt={`Logo de ${project.name}`} width={180} height={48} unoptimized={logo.startsWith("data:")} className="h-10 w-auto max-w-[170px] object-contain" /> : <strong className="text-xl font-black">{project.name}</strong>}
        {preview ? <span className="text-sm font-bold text-[var(--campaign-muted)]">Prévia da campanha</span> : <Link href={standardUrl} className="focus-ring inline-flex min-h-11 items-center rounded-xl px-3 py-2 text-right text-sm font-bold underline underline-offset-4">Ver página do negócio</Link>}
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-24">
      <div className="max-w-3xl">
        <h1 className="text-balance text-4xl font-black leading-[1.08] tracking-[-.035em] sm:text-5xl lg:text-6xl" style={{ fontFamily: `${project.designSystem.typography.headingFont}, ui-sans-serif, sans-serif` }}>{content.title}</h1>
        {content.message ? <p className="mt-6 max-w-[65ch] text-lg leading-8">{content.message}</p> : null}
        <div className="mt-8"><CampaignAction activation={activation} label={goal?.name || "Continuar"} preview={preview} /></div>
        {activation.endsAt ? <p className="mt-5 text-sm text-[var(--campaign-muted)]">Até {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: activation.timezone }).format(new Date(activation.endsAt))} ({activation.timezone.replaceAll("_", " ")}).</p> : null}
      </div>
      {content.blocks.length ? <div className="mt-16 grid gap-0 border-y border-[var(--campaign-border)] md:mt-24 md:grid-cols-2" aria-label="Detalhes da campanha">
        {content.blocks.map((block) => <section key={block.key} className="border-b border-[var(--campaign-border)] px-0 py-8 last:border-b-0 md:px-8 md:py-10 md:odd:border-r md:[&:nth-last-child(-n+2)]:border-b-0">
          {block.kind === "offer" ? <><p className="text-sm font-bold text-[var(--campaign-muted)]">Oferta da campanha</p><h2 className="mt-2 text-2xl font-extrabold">{block.title || block.label}</h2>{block.title && block.label ? <p className="mt-2 font-bold">{block.label}</p> : null}</> :
            block.kind === "conditions" ? <h2 className="text-2xl font-extrabold">{block.title}</h2> : <h2 className="text-2xl font-extrabold">{block.title || goal?.name || "Como continuar"}</h2>}
          {block.text ? <p className="mt-4 max-w-[65ch] whitespace-pre-line leading-7">{block.text}</p> : null}
          {block.kind === "action" ? <div className="mt-6"><CampaignAction activation={activation} label={block.label || goal?.name || "Continuar"} preview={preview} /></div> : null}
        </section>)}
      </div> : null}
    </main>
    <footer className="border-t border-[var(--campaign-border)] px-5 py-6 text-center text-sm text-[var(--campaign-muted)]">{!preview ? <><Link href={standardUrl} className="focus-ring font-bold underline underline-offset-4">Ver página do negócio</Link><span className="mx-3">·</span></> : null}Feito com Sobe · <Link href="/" className="focus-ring underline underline-offset-4">Conhecer a Sobe</Link></footer>
  </div>;
  return <ConversionLauncher projectSlug={project.slug} projectId={project.id} previewProject={preview ? project : undefined}>
    {preview ? shell : <ActivationRuntimeProvider projectId={project.id} activations={[{ ...activation, placements: [] }]}>{shell}</ActivationRuntimeProvider>}
  </ConversionLauncher>;
}
