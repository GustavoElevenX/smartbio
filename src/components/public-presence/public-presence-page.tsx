import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/types";
import type { PresencePage } from "@/features/presence/presence.types";
import { ConversionLauncher } from "./conversion-launcher";
import { PresenceActionButton } from "./presence-action-button";
import { PresenceSectionRenderer } from "./presence-section-renderer";
import { PresenceSectionTracker } from "./presence-section-tracker";
import { PresenceMobileMenu } from "./presence-mobile-menu";
import type { PublicActivation } from "@/features/activations/activation.types";
import { ActivationRuntimeProvider } from "@/components/public-activations/activation-runtime-provider";

function pagePath(project: Project, page: PresencePage) {
  return page.isHome ? `/${project.slug}` : `/${project.slug}/p/${page.key}`;
}
function logoUrl(project: Project) {
  return (
    project.brand.logoDataUrl ||
    project.brand.darkLogoDataUrl ||
    project.brand.lightLogoDataUrl
  );
}
function BrandHome({
  project,
  showLogo,
}: {
  project: Project;
  showLogo: boolean;
}) {
  const logo = showLogo ? logoUrl(project) : undefined;
  return (
    <Link
      href={`/${project.slug}`}
      aria-label={`Início — ${project.name}`}
      className="flex min-w-0 items-center"
    >
      {logo ? (
        <Image
          src={logo}
          alt={`Logo de ${project.name}`}
          width={180}
          height={48}
          unoptimized={logo.startsWith("data:")}
          className="h-9 w-auto max-w-[180px] object-contain object-left"
        />
      ) : (
        <span className="truncate text-xl font-black tracking-[-.04em]">
          {project.name}
        </span>
      )}
    </Link>
  );
}
function pageSocialLinks(project: Project, page: PresencePage) {
  const candidatePages = [
    page,
    ...(project.presence?.pages || []).filter(
      (candidate) => candidate.id !== page.id && candidate.isActive,
    ),
  ];
  const contact = candidatePages
    .flatMap((candidate) => candidate.sections)
    .find((section) => section.isActive && section.type === "contact");
  const links = (
    contact?.content as
      { socialLinks?: Array<{ label: string; url: string }> } | undefined
  )?.socialLinks;
  return Array.isArray(links) ? links : [];
}

export function PresencePageContent({
  project,
  page,
  publicActivations = [],
}: {
  project: Project;
  page: PresencePage;
  publicActivations?: PublicActivation[];
}) {
  const heroOverride = publicActivations.flatMap((activation) => activation.placements.map((placement) => ({ activation, placement }))).filter((item) => item.placement.placementType === "hero_override").toSorted((a,b) => b.placement.priority-a.placement.priority)[0];
  const activeSections = page.sections
    .filter((section) => section.isActive)
    .map((section) => section.type === "hero" && heroOverride ? { ...section, eyebrow: String(heroOverride.placement.content.eyebrow || heroOverride.activation.offer?.label || section.eyebrow || ""), title: String(heroOverride.placement.content.title || heroOverride.activation.title || section.title || ""), description: String(heroOverride.placement.content.message || heroOverride.activation.message || section.description || ""), content: { ...section.content, primaryAction: { type: "start_activation", label: String(heroOverride.placement.content.ctaLabel || "Quero aproveitar"), activationId: heroOverride.activation.id, style: "primary" } } } : section)
    .toSorted((a, b) => a.order - b.order);
  const pages = (project.presence?.pages || [])
    .filter((item) => item.isActive)
    .slice(0, 6);
  const header = page.settings.header;
  const footer = page.settings.footer;
  const anchoredLinks = activeSections
    .filter((section) => section.anchor)
    .slice(0, 5)
    .map((section) => ({
      href: `#${section.anchor}`,
      label: section.title || section.eyebrow || section.key,
    }));
  const pageLinks = pages
    .filter((item) => item.id !== page.id)
    .slice(0, 2)
    .map((item) => ({ href: pagePath(project, item), label: item.name }));
  const navigationLinks = [...anchoredLinks, ...pageLinks];
  const primaryActionHref = project.presence?.pages.find(
    (item) => item.id === header.primaryAction?.pageId,
  );
  const socialLinks = pageSocialLinks(project, page);
  return (
    <main>
      {header.enabled ? (
        <header
          className={`relative z-40 border-b border-black/[.07] bg-[var(--presence-bg)]/90 backdrop-blur-xl ${header.sticky ? "sticky top-0" : ""}`}
        >
          <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
            <BrandHome project={project} showLogo={header.showLogo} />
            {header.showNavigation ? (
              <nav
                aria-label="Navegação principal"
                className="hidden items-center gap-6 md:flex"
              >
                {navigationLinks.map((link) => (
                  <Link
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    className="text-sm font-bold text-[var(--presence-muted)] transition hover:text-[var(--presence-fg)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="hidden md:block">
              {header.primaryAction ? (
                <PresenceActionButton
                  action={header.primaryAction}
                  context={{ pageId: page.id }}
                  pageHref={
                    primaryActionHref
                      ? pagePath(project, primaryActionHref)
                      : undefined
                  }
                  className="min-h-10 px-4"
                />
              ) : null}
            </div>
            <PresenceMobileMenu
              links={header.showNavigation ? navigationLinks : []}
              action={header.primaryAction}
              pageId={page.id}
              actionHref={
                primaryActionHref
                  ? pagePath(project, primaryActionHref)
                  : undefined
              }
            />
          </div>
        </header>
      ) : null}
      {activeSections.map((section) => (
        <PresenceSectionTracker
          key={section.id}
          pageId={page.id}
          sectionId={section.id}
        >
          <PresenceSectionRenderer
            project={project}
            page={page}
            section={section}
            publicActivations={publicActivations}
          />
        </PresenceSectionTracker>
      ))}
      {footer.enabled ? (
        <footer className="border-t border-black/10 px-5 py-12 md:px-8">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <BrandHome project={project} showLogo={footer.showLogo} />
              <p className="mt-3 max-w-md text-sm leading-6 text-[var(--presence-muted)]">
                {project.description}
              </p>
              {project.phone ? (
                <a
                  href={`tel:${project.phone}`}
                  className="mt-4 inline-block text-sm font-bold"
                >
                  {project.phone}
                </a>
              ) : null}
              {footer.showSocialLinks && socialLinks.length ? (
                <nav
                  aria-label="Redes sociais"
                  className="mt-5 flex flex-wrap gap-x-5 gap-y-3"
                >
                  {socialLinks.map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-[var(--presence-primary)] underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              ) : null}
            </div>
            <div className="flex flex-wrap items-start gap-x-5 gap-y-2 text-sm font-bold">
              {pages.map((item) => (
                <Link key={item.id} href={pagePath(project, item)}>
                  {item.name}
                </Link>
              ))}
              {footer.showPolicies
                ? (project.commercialConfig?.policies || [])
                    .filter((policy) => policy.isActive)
                    .slice(0, 3)
                    .map((policy) => (
                      <span key={policy.id}>{policy.title}</span>
                    ))
                : null}
            </div>
          </div>
          <div className="mx-auto mt-10 flex max-w-6xl flex-wrap justify-between gap-3 border-t border-black/10 pt-6 text-xs text-[var(--presence-muted)]">
            <span>
              © {new Date().getFullYear()} {project.name}
            </span>
            {footer.showVirouBranding ? (
              <span>
                Feito com{" "}
                <strong className="text-[var(--presence-primary)]">
                  Virou
                </strong>
              </span>
            ) : null}
          </div>
        </footer>
      ) : null}
    </main>
  );
}

export function PublicPresencePage({
  project,
  page,
  preview = false,
  publicActivations = [],
}: {
  project: Project;
  page: PresencePage;
  preview?: boolean;
  publicActivations?: PublicActivation[];
}) {
  const colors = project.designSystem.colors;
  const shape = project.designSystem.shape;
  const elevation = project.designSystem.elevation;
  const style = {
    "--presence-primary": colors.primary,
    "--presence-bg": colors.background,
    "--presence-fg": colors.foreground,
    "--presence-muted": colors.mutedForeground,
    "--presence-heading-font": project.designSystem.typography.headingFont,
    "--presence-card-radius": `${shape.cardRadius}px`,
    "--presence-button-radius": `${shape.buttonRadius}px`,
    "--presence-border-width": `${shape.borderWidth}px`,
    "--presence-card-shadow": elevation.cardShadow,
    "--presence-floating-shadow": elevation.floatingShadow,
    background: colors.background,
    color: colors.foreground,
    fontFamily: project.designSystem.typography.bodyFont,
  } as CSSProperties;
  return (
    <div
      style={style}
      className="presence-page min-h-screen overflow-x-clip bg-[var(--presence-bg)] text-[var(--presence-fg)]"
    >
      <ConversionLauncher
        projectSlug={project.slug}
        projectId={project.id}
        pageId={page.id}
        presentation={page.settings.conversionPresentation.mode}
        previewProject={preview ? project : undefined}
      >
        <ActivationRuntimeProvider projectId={project.id} pageId={page.id} activations={publicActivations}>
          <PresencePageContent project={project} page={page} publicActivations={publicActivations} />
        </ActivationRuntimeProvider>
      </ConversionLauncher>
    </div>
  );
}
