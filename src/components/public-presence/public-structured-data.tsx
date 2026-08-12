import type { Project } from "@/types";
import type { PresencePage } from "@/features/presence/presence.types";

export function PublicStructuredData({ project, page, canonical }: { project: Project; page: PresencePage; canonical: string }) {
  const locations = (project.commercialConfig?.locations || []).filter((location) => location.isActive);
  const graph: Array<Record<string, unknown>> = [
    { "@type": "Organization", "@id": `${canonical}#organization`, name: project.name, description: project.description || undefined, url: canonical, telephone: project.phone || undefined },
    { "@type": "WebPage", "@id": `${canonical}#webpage`, url: canonical, name: page.seoTitle || page.title || page.name, description: page.seoDescription || page.description || project.description, isPartOf: { "@id": `${canonical}#organization` } },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: project.name, item: `/${project.slug}` }, ...(page.isHome ? [] : [{ "@type": "ListItem", position: 2, name: page.name, item: canonical }])] },
  ];
  locations.forEach((location) => graph.push({ "@type": "LocalBusiness", name: location.name, telephone: location.phone || undefined, url: location.externalUrl || canonical, address: { "@type": "PostalAddress", streetAddress: [location.addressLine || location.address, location.addressNumber].filter(Boolean).join(", ") || undefined, addressLocality: location.city || undefined, addressRegion: location.state || undefined, postalCode: location.postalCode || undefined, addressCountry: location.countryCode }, geo: location.latitude != null && location.longitude != null ? { "@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude } : undefined }));
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
