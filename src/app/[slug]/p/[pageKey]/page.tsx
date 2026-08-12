import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicExperience } from "@/components/public-experience/public-experience";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { PublicStructuredData } from "@/components/public-presence/public-structured-data";
import { resolvePublicSurface } from "@/features/presence/resolve-public-surface";
import { loadPublishedPublicProject } from "@/server/projects/load-public-project";

const baseUrl = () => (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }

export async function generateMetadata({ params }: PageProps<"/[slug]/p/[pageKey]">): Promise<Metadata> {
  const { slug, pageKey } = await params;
  const project = await loadPublishedPublicProject(slug);
  const page = project?.presence?.pages.find((item) => item.key === pageKey && item.isActive);
  if (!project || !page) return { title: "Página indisponível", robots: { index: false, follow: false } };
  const title = page.seoTitle || page.title || page.name;
  const description = page.seoDescription || page.description || project.description;
  const canonical = `${baseUrl()}/${project.slug}/p/${page.key}`;
  const ogAsset = project.mediaAssets?.find((item) => item.id === page.ogImageAssetId);
  const ogUrl = typeof ogAsset?.metadata?.publicUrl === "string" ? ogAsset.metadata.publicUrl : undefined;
  return { title, description, alternates: { canonical }, robots: { index: page.isIndexable, follow: true }, openGraph: { title, description, url: canonical, images: ogUrl ? [{ url: ogUrl, alt: title }] : undefined } };
}

export default async function SecondaryPresencePage({ params, searchParams }: PageProps<"/[slug]/p/[pageKey]">) {
  const [{ slug, pageKey }, query] = await Promise.all([params, searchParams]);
  const project = await loadPublishedPublicProject(slug);
  if (!project) notFound();
  const surface = resolvePublicSurface(project, value(query.entry), pageKey);
  if (surface.mode === "conversion_direct") return <PublicExperience slug={slug} />;
  if (!surface.page || surface.page.key !== pageKey && !surface.entry) notFound();
  const canonical = `${baseUrl()}/${project.slug}/p/${surface.page.key}`;
  return <><PublicStructuredData project={project} page={surface.page} canonical={canonical} /><PublicPresencePage project={project} page={surface.page} /></>;
}
