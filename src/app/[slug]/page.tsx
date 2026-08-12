import type { Metadata } from "next";
import { PublicExperience } from "@/components/public-experience/public-experience";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { PublicStructuredData } from "@/components/public-presence/public-structured-data";
import { resolvePublicSurface } from "@/features/presence/resolve-public-surface";
import { loadPublishedPublicProject } from "@/server/projects/load-public-project";
import { resolvePublicActivations } from "@/server/activations/public-activation-resolver";
import { createServiceClient } from "@/lib/supabase/server";

const baseUrl = () => (process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }

export async function generateMetadata({ params, searchParams }: PageProps<"/[slug]">): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const project = await loadPublishedPublicProject(slug);
  if (!project) return { title: "Experiência indisponível", robots: { index: false, follow: false } };
  const surface = resolvePublicSurface(project, value(query.entry), null);
  const page = surface.page;
  const title = page?.seoTitle || page?.title || project.name;
  const description = page?.seoDescription || page?.description || project.description || "Uma experiência criada com Virou.";
  const canonical = `${baseUrl()}/${project.slug}`;
  const ogAsset = project.mediaAssets?.find((item) => item.id === page?.ogImageAssetId);
  const ogUrl = typeof ogAsset?.metadata?.publicUrl === "string" ? ogAsset.metadata.publicUrl : undefined;
  return { title, description, alternates: { canonical }, robots: page ? { index: page.isIndexable, follow: true } : { index: true, follow: true }, openGraph: { title, description, url: canonical, type: "website", images: ogUrl ? [{ url: ogUrl, alt: title }] : undefined } };
}

export default async function PublicProjectPage({ params, searchParams }: PageProps<"/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const project = await loadPublishedPublicProject(slug);
  const surface = project ? resolvePublicSurface(project, value(query.entry), null) : null;
  if (!project || !surface?.page || surface.mode === "conversion_direct") return <PublicExperience slug={slug} />;
  const publicActivations = await resolvePublicActivations(createServiceClient(), { projectId: project.id, entryPointId: surface.entry?.id, pageId: surface.page.id });
  const canonical = `${baseUrl()}/${project.slug}`;
  return <><PublicStructuredData project={project} page={surface.page} canonical={canonical} /><PublicPresencePage project={project} page={surface.page} publicActivations={publicActivations} /></>;
}
