import type { CSSProperties } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import type { PresencePage } from "@/features/presence/presence.types";
import { ConversionLauncher } from "./conversion-launcher";
import { PresenceActionButton } from "./presence-action-button";
import { PresenceSectionRenderer } from "./presence-section-renderer";
import { PresenceSectionTracker } from "./presence-section-tracker";

function pagePath(project: Project, page: PresencePage) { return page.isHome ? `/${project.slug}` : `/${project.slug}/p/${page.key}`; }

export function PresencePageContent({ project, page }: { project: Project; page: PresencePage }) {
  const activeSections = page.sections.filter((section) => section.isActive).toSorted((a, b) => a.order - b.order);
  const pages = (project.presence?.pages || []).filter((item) => item.isActive).slice(0, 6);
  const header = page.settings.header;
  const footer = page.settings.footer;
  return <main>
    {header.enabled ? <header className={`z-40 border-b border-black/[.07] bg-[var(--presence-bg)]/90 backdrop-blur-xl ${header.sticky ? "sticky top-0" : ""}`}><div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-5 px-5 md:px-8"><Link href={`/${project.slug}`} className="text-xl font-black tracking-[-.04em]">{project.name}</Link>{header.showNavigation ? <nav aria-label="Navegação principal" className="hidden items-center gap-6 md:flex">{activeSections.filter((section) => section.anchor).slice(0, 5).map((section) => <a key={section.id} href={`#${section.anchor}`} className="text-sm font-bold text-[var(--presence-muted)] transition hover:text-[var(--presence-fg)]">{section.title || section.eyebrow || section.key}</a>)}{pages.filter((item) => item.id !== page.id).slice(0, 2).map((item) => <Link key={item.id} href={pagePath(project, item)} className="text-sm font-bold text-[var(--presence-muted)]">{item.name}</Link>)}</nav> : null}{header.primaryAction ? <PresenceActionButton action={header.primaryAction} context={{ pageId: page.id }} pageHref={project.presence?.pages.find((item) => item.id === header.primaryAction?.pageId) ? pagePath(project, project.presence!.pages.find((item) => item.id === header.primaryAction!.pageId)!) : undefined} className="min-h-10 px-4" /> : null}</div></header> : null}
    {activeSections.map((section) => <PresenceSectionTracker key={section.id} pageId={page.id} sectionId={section.id}><PresenceSectionRenderer project={project} page={page} section={section} /></PresenceSectionTracker>)}
    {footer.enabled ? <footer className="border-t border-black/10 px-5 py-12 md:px-8"><div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto]"><div><p className="text-lg font-black">{project.name}</p><p className="mt-2 max-w-md text-sm leading-6 text-[var(--presence-muted)]">{project.description}</p>{project.phone ? <a href={`tel:${project.phone}`} className="mt-4 inline-block text-sm font-bold">{project.phone}</a> : null}</div><div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-sm font-bold">{pages.map((item) => <Link key={item.id} href={pagePath(project, item)}>{item.name}</Link>)}{footer.showPolicies ? (project.commercialConfig?.policies || []).filter((policy) => policy.isActive).slice(0, 3).map((policy) => <span key={policy.id}>{policy.title}</span>) : null}</div></div><div className="mx-auto mt-10 flex max-w-6xl justify-between border-t border-black/10 pt-6 text-xs text-[var(--presence-muted)]"><span>© {new Date().getFullYear()} {project.name}</span>{footer.showVirouBranding ? <span>Feito com <strong className="text-[var(--presence-primary)]">Virou</strong></span> : null}</div></footer> : null}
  </main>;
}

export function PublicPresencePage({ project, page, preview = false }: { project: Project; page: PresencePage; preview?: boolean }) {
  const colors = project.designSystem.colors;
  const style = { "--presence-primary": colors.primary, "--presence-bg": colors.background, "--presence-fg": colors.foreground, "--presence-muted": colors.mutedForeground, background: colors.background, color: colors.foreground, fontFamily: project.designSystem.typography.bodyFont } as CSSProperties;
  return <div style={style} className="min-h-screen overflow-x-clip bg-[var(--presence-bg)] text-[var(--presence-fg)]"><ConversionLauncher projectSlug={project.slug} projectId={project.id} pageId={page.id} presentation={page.settings.conversionPresentation.mode} previewProject={preview ? project : undefined}><PresencePageContent project={project} page={page} /></ConversionLauncher></div>;
}
