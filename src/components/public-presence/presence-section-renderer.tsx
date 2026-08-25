/* eslint-disable @typescript-eslint/no-explicit-any -- renderer consumes content validated by the section-specific Zod registry */
import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, MapPin, Play, Quote } from "lucide-react";
import type { CSSProperties } from "react";
import type { Project } from "@/types";
import type {
  PresenceAction,
  PresencePage,
  PresenceSection,
} from "@/features/presence/presence.types";
import { PresenceActionButton } from "./presence-action-button";
import { GalleryLightbox } from "./gallery-lightbox";
import { NearestLocationButton } from "./nearest-location-button";
import type { PublicActivation } from "@/features/activations/activation.types";
import { ActivationProductBadge } from "@/components/public-activations/activation-product-badge";
import { ActivationServiceBadge } from "@/components/public-activations/activation-service-badge";
import { PublicCatalogShell } from "@/components/public-catalog/catalog-shell";

function asset(project: Project, id?: string) {
  const item = project.mediaAssets?.find((candidate) => candidate.id === id);
  const url =
    item?.metadata?.publicUrl ||
    item?.metadata?.signedUrl ||
    item?.metadata?.url;
  return typeof url === "string"
    ? { url, alt: item?.altText || item?.originalName || "Imagem" }
    : undefined;
}
function money(value?: number, currency = "BRL") {
  return value == null
    ? "Sob consulta"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
        value,
      );
}
function pageHref(project: Project, action?: PresenceAction) {
  const page = project.presence?.pages.find(
    (item) => item.id === action?.pageId,
  );
  return page
    ? page.isHome
      ? `/${project.slug}`
      : `/${project.slug}/p/${page.key}`
    : undefined;
}
const widthClasses = {
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const;
const spacingClasses = {
  compact: "py-12 md:py-16",
  normal: "py-16 md:py-24",
  airy: "py-24 md:py-32",
} as const;
function sectionWidth(page: PresencePage, section: PresenceSection) {
  return widthClasses[
    section.style.width || page.settings.layout.maxWidth || "xl"
  ];
}
function sectionSpacing(page: PresencePage, section: PresenceSection) {
  return spacingClasses[
    section.style.spacing || page.settings.layout.sectionSpacing || "normal"
  ];
}
function sectionTone(section: PresenceSection) {
  if (section.style.theme) return section.style.theme;
  if (section.style.background === "muted") return "muted";
  if (section.style.background === "primary") return "brand";
  if (section.style.background === "dark") return "dark";
  return "default";
}
function toneClasses(tone: ReturnType<typeof sectionTone>) {
  return tone === "muted"
    ? "bg-black/[.035]"
    : tone === "brand"
      ? "bg-[var(--presence-primary)] text-white"
      : tone === "dark"
        ? "bg-[#07172f] text-white"
        : tone === "default"
          ? ""
          : "";
}
function appearance(project: Project, section: PresenceSection) {
  const background = asset(project, section.style.backgroundAssetId);
  const tone = sectionTone(section);
  const inverse = tone === "brand" || tone === "dark" || Boolean(background);
  return {
    background,
    tone,
    style: {
      ...(background
        ? { backgroundImage: `url("${background.url.replace(/"/g, "%22")}")` }
        : {}),
      ...(inverse
        ? {
            "--presence-section-muted": "rgba(255,255,255,.76)",
            "--presence-muted": "rgba(255,255,255,.76)",
          }
        : {}),
    } as CSSProperties,
  };
}
function Actions({
  project,
  page,
  section,
  primary,
  secondary,
}: {
  project: Project;
  page: PresencePage;
  section: PresenceSection;
  primary?: PresenceAction;
  secondary?: PresenceAction;
}) {
  return primary || secondary ? (
    <div className="mt-7 flex flex-wrap gap-3">
      {primary ? (
        <PresenceActionButton
          action={primary}
          pageHref={pageHref(project, primary)}
          context={{ pageId: page.id, sectionId: section.id }}
        />
      ) : null}
      {secondary ? (
        <PresenceActionButton
          action={secondary}
          pageHref={pageHref(project, secondary)}
          context={{ pageId: page.id, sectionId: section.id }}
        />
      ) : null}
    </div>
  ) : null;
}
function Heading({ section }: { section: PresenceSection }) {
  return section.eyebrow || section.title || section.description ? (
    <header
      className={`mb-8 max-w-3xl ${section.style.alignment === "center" ? "mx-auto text-center" : ""}`}
    >
      {section.eyebrow ? (
        <p className="mb-3 text-xs font-black uppercase tracking-[.18em] text-[var(--presence-primary)]">
          {section.eyebrow}
        </p>
      ) : null}
      {section.title ? (
        <h2 className="text-balance text-3xl font-black tracking-[-.04em] md:text-5xl">
          {section.title}
        </h2>
      ) : null}
      {section.description ? (
        <p className="mt-4 text-pretty text-base leading-7 text-[var(--presence-section-muted,var(--presence-muted))] md:text-lg">
          {section.description}
        </p>
      ) : null}
    </header>
  ) : null;
}
const verified = (status: unknown) =>
  status === "confirmed" || status === "source_verified";

export function PresenceSectionRenderer({
  project,
  page,
  section,
  publicActivations = [],
}: {
  project: Project;
  page: PresencePage;
  section: PresenceSection;
  publicActivations?: PublicActivation[];
}) {
  const content = section.content as Record<string, any>; // Content was validated by the section registry before persistence.
  const context = { pageId: page.id, sectionId: section.id };
  if (section.type === "divider")
    return (
      <section
        id={section.anchor}
        className={`mx-auto px-5 ${sectionWidth(page, section)}`}
      >
        <hr className="border-black/10" />
        {content.label ? (
          <p className="-mt-3 mx-auto w-fit bg-[var(--presence-bg)] px-3 text-xs font-bold text-[var(--presence-muted)]">
            {content.label}
          </p>
        ) : null}
      </section>
    );
  if (section.type === "hero") {
    const image = asset(project, content.media?.assetId);
    const visual = appearance(project, section);
    const variant = content.variant || (content.alignment === "center" ? "centered" : "split");
    const backgroundImage = variant === "background" || content.media?.position === "background" ? image : undefined;
    const centered = variant === "centered" || content.alignment === "center";
    const showSideImage = image && !backgroundImage && variant !== "minimal" ? image : undefined;
    const imageFirst = content.media?.position === "left" || variant === "product_focus";
    return (
      <section
        id={section.anchor}
        data-radius={section.style.radius}
        data-media-treatment={section.style.mediaTreatment}
        style={visual.style}
        data-hero-variant={variant}
        className={`presence-section relative isolate overflow-hidden bg-cover bg-center px-5 md:px-8 ${variant === "minimal" ? "py-16 md:py-20" : sectionSpacing(page, section)} ${toneClasses(visual.tone)} ${visual.background || backgroundImage ? "text-white" : ""}`}
      >
        {backgroundImage ? <Image src={backgroundImage.url} alt="" fill priority sizes="100vw" className="-z-20 object-cover" /> : null}
        {visual.background || backgroundImage ? (
          <span
            aria-hidden
            className={`absolute inset-0 -z-10 ${visual.tone === "dark" || visual.tone === "brand" ? "bg-black/55" : "bg-black/45"}`}
          />
        ) : null}
        <div
          className={`mx-auto grid min-w-0 items-center ${variant === "minimal" ? "min-h-[360px]" : "min-h-[480px]"} ${variant === "editorial" ? "gap-8 md:grid-cols-[1.2fr_.8fr]" : showSideImage && !centered ? "gap-12 md:grid-cols-2" : "md:grid-cols-1"} ${sectionWidth(page, section)}`}
        >
          <div
            className={`min-w-0 max-w-full ${centered ? "text-center md:col-span-2 md:mx-auto md:max-w-4xl" : ""} ${imageFirst && showSideImage ? "md:order-2" : ""} ${variant === "offer_focus" ? "rounded-2xl bg-white p-7 text-[#07172f] shadow-[0_24px_70px_rgba(15,23,42,.22)] md:p-10" : ""}`}
          >
            {section.eyebrow ? (
              <p className="mb-4 text-xs font-black uppercase tracking-[.2em] text-[var(--presence-primary)]">
                {section.eyebrow}
              </p>
            ) : null}
            <h1 className={`max-w-full break-words text-balance font-black leading-[.98] tracking-[-.04em] [overflow-wrap:anywhere] ${variant === "editorial" ? "text-[clamp(2.5rem,12vw,3.75rem)] md:text-8xl" : variant === "minimal" ? "text-[clamp(2.25rem,11vw,3.25rem)] md:text-6xl" : "text-[clamp(2.5rem,12vw,3.75rem)] md:text-7xl"}`}>
              {section.title || page.title || project.name}
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[var(--presence-section-muted,var(--presence-muted))] md:text-xl">
              {section.description || page.description || project.description}
            </p>
            {Array.isArray(content.badges) && content.badges.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {content.badges.map((badge: string) => (
                  <span
                    key={badge}
                    className="rounded-full border border-black/10 bg-white/85 px-3 py-1 text-xs font-bold text-[#07172f]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
            <Actions
              project={project}
              page={page}
              section={section}
              primary={content.primaryAction}
              secondary={content.secondaryAction}
            />
          </div>
          {showSideImage && !centered ? (
            <div
              data-presence-media
              className={`relative overflow-hidden bg-black/5 shadow-[0_28px_80px_rgba(15,23,42,.24)] ${imageFirst ? "md:order-1" : ""} ${variant === "editorial" ? "aspect-[3/4] md:-rotate-2" : variant === "product_focus" ? "aspect-square" : "aspect-[4/5]"}`}
            >
              <Image
                src={showSideImage.url}
                alt={showSideImage.alt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  const visual = appearance(project, section);
  const wrap = (children: React.ReactNode, extra = "", showHeading = true) => (
    <section
      id={section.anchor}
      data-radius={section.style.radius}
      data-media-treatment={section.style.mediaTreatment}
      style={visual.style}
      className={`presence-section relative isolate bg-cover bg-center px-5 md:px-8 ${sectionSpacing(page, section)} ${toneClasses(visual.tone)} ${visual.background ? "text-white" : ""} ${extra}`}
    >
      {visual.background ? (
        <span
          aria-hidden
          className={`absolute inset-0 -z-10 ${visual.tone === "dark" || visual.tone === "brand" ? "bg-black/55" : "bg-black/[.48]"}`}
        />
      ) : null}
      <div className={`relative mx-auto ${sectionWidth(page, section)}`}>
        {showHeading ? <Heading section={section} /> : null}
        {children}
      </div>
    </section>
  );
  if (section.type === "rich_text")
    return wrap(
      <div className="max-w-3xl space-y-4 text-base leading-8 text-[var(--presence-muted)]">
        {String(content.body || "")
          .split(/\n{2,}/)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        <Actions
          project={project}
          page={page}
          section={section}
          primary={content.action}
        />
      </div>,
    );
  if (section.type === "benefits" || section.type === "feature_grid")
    return wrap(
      <div className="grid gap-4 md:grid-cols-3">
        {(content.items || []).map((item: any) => (
          <article
            key={item.id}
            className="rounded-3xl border border-black/10 bg-white/80 p-6 text-[#07172f] shadow-sm"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--presence-primary)]/10 text-[var(--presence-primary)]">
              <Check size={18} />
            </span>
            <h3 className="mt-5 text-lg font-black">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#66636e]">
              {item.description}
            </p>
          </article>
        ))}
      </div>,
    );
  if (section.type === "services") {
    const chosen = (project.commercialConfig?.serviceOfferings || []).filter(
      (item) =>
        item.isActive &&
        (!content.serviceIds?.length || content.serviceIds.includes(item.id)),
    );
    return wrap(
      <div className={`grid gap-4 ${content.layout === "list" ? "md:grid-cols-1" : content.layout === "featured" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {chosen.map((service, index) => {
          const image = asset(project, service.imageAssetId);
          const activation = publicActivations.find((candidate) => candidate.placements.some((placement) => placement.placementType === "service_badge") && (!candidate.offer?.scope.serviceOfferingIds?.length || candidate.offer.scope.serviceOfferingIds.includes(service.id)));
          return (
            <article
              key={service.id}
              className={`overflow-hidden rounded-3xl border border-black/10 bg-white text-[#07172f] shadow-sm ${content.layout === "featured" && index === 0 ? "md:col-span-2 md:grid md:grid-cols-2" : content.layout === "list" ? "md:grid md:grid-cols-[minmax(220px,32%)_1fr]" : ""}`}
            >
              {image ? (
                <div data-presence-media className="relative aspect-[16/10]">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="33vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <div className="p-6">
                {activation ? <div className="mb-3"><ActivationServiceBadge label={activation.offer?.label || activation.name} /></div> : null}
                <h3 className="text-xl font-black">{service.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66636e]">
                  {service.shortDescription || service.description}
                </p>
                {content.showPrice ? (
                  <p className="mt-4 font-extrabold text-[var(--presence-primary)]">
                    {service.priceMode === "starting_at" ? "A partir de " : ""}
                    {money(service.price || service.minPrice, service.currency)}
                  </p>
                ) : null}
                {activation || content.itemAction ? (
                  <div className="mt-5">
                    <PresenceActionButton
                      action={activation ? { type: "start_activation", label: "Quero aproveitar", activationId: activation.id, style: "primary" } : content.itemAction}
                      pageHref={activation ? undefined : pageHref(project, content.itemAction)}
                      context={{ ...context, serviceId: service.id }}
                    />
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>,
    );
  }
  if (section.type === "products") {
    const allAvailable = (project.commercialConfig?.catalogItems || []).filter((item) => item.isAvailable);
    const fullCatalog = content.displayMode === "catalog" || page.key.includes("catalog") || page.name.toLocaleLowerCase("pt-BR").includes("catálogo");
    if (fullCatalog && allAvailable.length > 8) return wrap(<PublicCatalogShell projectId={project.id} pageId={page.id} sectionId={section.id} goalId={content.itemGoalId || page.defaultConversionGoalId} />);
    const chosen = (project.commercialConfig?.catalogItems || [])
      .filter(
        (item) =>
          item.isAvailable &&
          (!content.itemIds?.length || content.itemIds.includes(item.id)) &&
          (!content.categoryIds?.length ||
            (item.categoryId && content.categoryIds.includes(item.categoryId))),
      )
      .slice(0, content.maxItems || 8);
    const catalogPage = project.presence?.pages.find((candidate) => candidate.isActive && candidate.id !== page.id && (candidate.key.includes("catalog") || candidate.name.toLocaleLowerCase("pt-BR").includes("catálogo")));
    return wrap(
      <><div className={content.layout === "carousel" ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" : `grid gap-4 ${content.layout === "featured" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
        {chosen.map((item, index) => {
          const image = asset(project, item.imageAssetId);
          const activation = publicActivations.find((candidate) => candidate.placements.some((placement) => placement.placementType === "product_badge") && (!candidate.offer?.scope.catalogItemIds?.length || candidate.offer.scope.catalogItemIds.includes(item.id)));
          const action: PresenceAction = activation ? { type: "start_activation", label: "Quero aproveitar", activationId: activation.id, style: "primary" } : {
            type: "start_conversion_goal",
            label: "Escolher",
            conversionGoalId:
              content.itemGoalId || page.defaultConversionGoalId,
            style: "secondary",
          };
          return (
            <article
              key={item.id}
              className={`overflow-hidden rounded-3xl border border-black/10 bg-white text-[#07172f] ${content.layout === "carousel" ? "w-[78%] shrink-0 snap-center sm:w-[46%] md:w-[30%]" : ""} ${content.layout === "featured" && index === 0 ? "md:col-span-2 md:row-span-2" : ""}`}
            >
              {image ? (
                <div data-presence-media className="relative aspect-square">
                  <Image
                    src={image.url}
                    alt={image.alt}
                    fill
                    sizes="25vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div data-presence-media className="aspect-square bg-black/5" />
              )}
              <div className="p-4">
                {activation ? <div className="mb-3"><ActivationProductBadge label={activation.offer?.label || activation.name} /></div> : null}
                <h3 className="font-black">{item.name}</h3>
                {content.showPrice ? (
                  <p className="mt-1 text-sm font-bold text-[var(--presence-primary)]">
                    {money(item.price, item.currency)}
                  </p>
                ) : null}
                {action.conversionGoalId ? (
                  <div className="mt-4">
                    <PresenceActionButton
                      action={action}
                      context={{ ...context, catalogItemId: item.id }}
                    />
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>{allAvailable.length > 8 && catalogPage ? <div className="mt-8 text-center"><Link href={pageHref(project, { type: "go_to_presence_page", label: "Ver catálogo completo", pageId: catalogPage.id }) || `/${project.slug}/p/${catalogPage.key}`} className="inline-flex min-h-12 items-center rounded-[var(--presence-button-radius)] border border-black/15 bg-white px-6 text-sm font-extrabold">Ver catálogo completo</Link></div> : null}</>,
    );
  }
  if (section.type === "about") {
    const image = asset(project, content.mediaAssetId);
    return wrap(
      <div className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-4 text-base leading-8 text-[var(--presence-muted)]">
          <p>{content.body}</p>
          {(content.bullets || []).map((item: string) => (
            <p key={item} className="flex gap-3">
              <Check
                className="mt-1 shrink-0 text-[var(--presence-primary)]"
                size={18}
              />
              {item}
            </p>
          ))}
          <Actions
            project={project}
            page={page}
            section={section}
            primary={content.action}
          />
        </div>
        {image ? (
          <div
            data-presence-media
            className="relative aspect-[4/3] overflow-hidden rounded-[32px]"
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>,
    );
  }
  if (section.type === "stats")
    return wrap(
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(content.items || [])
          .filter((item: any) => verified(item.verificationStatus))
          .map((item: any) => (
            <div
              key={item.id}
              className="rounded-3xl border border-black/10 bg-white/80 p-6 text-[#07172f]"
            >
              <strong className="text-3xl font-black text-[var(--presence-primary)]">
                {item.value}
              </strong>
              <p className="mt-2 text-sm text-[#66636e]">{item.label}</p>
            </div>
          ))}
      </div>,
    );
  if (section.type === "logo_cloud") {
    const images = (content.assetIds || [])
      .map((id: string) => asset(project, id))
      .filter(Boolean);
    return wrap(
      <div className="flex flex-wrap items-center justify-center gap-8">
        {images.map((image: any) => (
          <div
            key={image.url}
            className="relative h-12 w-32 grayscale opacity-70"
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="128px"
              className="object-contain"
            />
          </div>
        ))}
      </div>,
    );
  }
  if (section.type === "gallery" || section.type === "portfolio") {
    const images = (content.assetIds || [])
      .map((id: string) => asset(project, id))
      .filter(Boolean);
    return wrap(<GalleryLightbox images={images} layout={content.layout || "grid"} columns={content.columns || 3} />);
  }
  if (section.type === "testimonials")
    return wrap(
      <div className={content.layout === "carousel" ? "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4" : content.layout === "quote" ? "mx-auto max-w-4xl" : "grid gap-4 md:grid-cols-3"}>
        {(content.items || [])
          .filter((item: any) => verified(item.verificationStatus))
          .map((item: any) => (
            <figure
              key={item.id}
              className={`rounded-3xl border border-black/10 bg-white text-[#07172f] ${content.layout === "quote" ? "p-8 text-xl md:p-12 md:text-2xl" : "p-6"} ${content.layout === "carousel" ? "w-[86%] shrink-0 snap-center md:w-[45%]" : ""}`}
            >
              <Quote className="text-[var(--presence-primary)]" />
              <blockquote className="mt-5 leading-7">“{item.quote}”</blockquote>
              <figcaption className="mt-5 text-sm">
                <strong>{item.author}</strong>
                {item.role || item.company ? (
                  <span className="block text-[#66636e]">
                    {[item.role, item.company].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </figcaption>
            </figure>
          ))}
      </div>,
    );
  if (section.type === "faq")
    return wrap(
      <div className="mx-auto max-w-3xl divide-y divide-black/10">
        {(content.items || []).map((item: any) => (
          <details key={item.id} className="group py-5">
            <summary className="cursor-pointer list-none text-lg font-black">
              {item.question}
            </summary>
            <p className="mt-3 leading-7 text-[var(--presence-muted)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>,
    );
  if (section.type === "pricing")
    return wrap(
      <div className="grid gap-4 md:grid-cols-3">
        {(content.items || [])
          .filter((item: any) => verified(item.verificationStatus))
          .map((item: any) => (
            <article
              key={item.id}
              className={`rounded-3xl border p-6 ${item.highlighted ? "border-[var(--presence-primary)] bg-[var(--presence-primary)] text-white" : "border-black/10 bg-white text-[#07172f]"}`}
            >
              <h3 className="text-xl font-black">{item.name}</h3>
              {item.priceLabel ? (
                <p className="mt-4 text-3xl font-black">{item.priceLabel}</p>
              ) : null}
              <p className="mt-3 text-sm opacity-70">{item.description}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {item.features.map((feature: string) => (
                  <li key={feature} className="flex gap-2">
                    <Check size={16} />
                    {feature}
                  </li>
                ))}
              </ul>
              {item.action ? (
                <div className="mt-6">
                  <PresenceActionButton
                    action={item.action}
                    pageHref={pageHref(project, item.action)}
                    context={context}
                  />
                </div>
              ) : null}
            </article>
          ))}
      </div>,
    );
  if (section.type === "locations") {
    const locations = (project.commercialConfig?.locations || []).filter(
      (item) =>
        item.isActive &&
        (!content.locationIds?.length || content.locationIds.includes(item.id)),
    );
    return wrap(
      <>
        <div className="mb-6">
          <NearestLocationButton projectId={project.id} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {locations.map((location) => (
            <article
              key={location.id}
              className="rounded-3xl border border-black/10 bg-white p-6 text-[#07172f]"
            >
              <MapPin className="text-[var(--presence-primary)]" />
              <h3 className="mt-4 text-lg font-black">{location.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[#66636e]">
                {[
                  location.addressLine || location.address,
                  location.addressNumber,
                  location.neighborhood,
                  location.city,
                  location.state,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {content.showPhone && location.phone ? (
                <a
                  href={`tel:${location.phone}`}
                  className="mt-4 block text-sm font-bold"
                >
                  {location.phone}
                </a>
              ) : null}
              {content.showMapLink && location.externalUrl ? (
                <a
                  href={location.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex gap-2 text-sm font-extrabold text-[var(--presence-primary)]"
                >
                  Abrir mapa <ExternalLink size={15} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
        <Actions
          project={project}
          page={page}
          section={section}
          primary={content.nearestAction}
        />
      </>,
    );
  }
  if (section.type === "contact")
    return wrap(
      <div
        data-presence-surface
        className="grid gap-8 rounded-[32px] border border-black/10 bg-white p-7 text-[#07172f] md:grid-cols-2 md:p-10"
      >
        <div className="space-y-3">
          {content.email ? (
            <a
              className="block text-lg font-black"
              href={`mailto:${content.email}`}
            >
              {content.email}
            </a>
          ) : null}
          {content.phone ? (
            <a
              className="block text-lg font-black"
              href={`tel:${content.phone}`}
            >
              {content.phone}
            </a>
          ) : null}
          {content.whatsapp ? (
            <a
              className="block text-lg font-black text-[var(--presence-primary)]"
              href={`https://wa.me/${String(content.whatsapp).replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp
            </a>
          ) : null}
          {content.address ? (
            <p className="text-[#66636e]">{content.address}</p>
          ) : null}
        </div>
        <div>
          {(content.socialLinks || []).map((item: any) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="mr-4 inline-flex min-h-11 items-center font-bold text-[var(--presence-primary)] underline-offset-4 hover:underline"
            >
              {item.label}
            </a>
          ))}
          <Actions
            project={project}
            page={page}
            section={section}
            primary={content.action}
          />
        </div>
      </div>,
    );
  if (section.type === "video")
    return wrap(
      <a
        href={content.url}
        target="_blank"
        rel="noreferrer"
        className="group grid aspect-video place-items-center rounded-[32px] bg-[#07172f] text-white"
      >
        <span className="grid size-20 place-items-center rounded-full bg-white text-black transition group-hover:scale-105">
          <Play />
        </span>
        <span className="sr-only">Assistir vídeo</span>
      </a>,
    );
  if (section.type === "conversion_cta")
    return wrap(
      <div
        data-presence-surface
        className="rounded-[36px] bg-[linear-gradient(135deg,var(--presence-primary),#ff745e)] p-8 text-white shadow-2xl md:p-14"
      >
        <h2 className="max-w-3xl text-balance text-3xl font-black tracking-[-.04em] md:text-5xl">
          {section.title}
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-white/80">
          {section.description}
        </p>
        <Actions
          project={project}
          page={page}
          section={section}
          primary={content.primaryAction}
          secondary={content.secondaryAction}
        />
      </div>,
      "",
      false,
    );
  return wrap(
    <div className="rounded-2xl border border-dashed border-black/20 p-8 text-center text-sm text-[var(--presence-muted)]">
      Seção indisponível.
    </div>,
  );
}
