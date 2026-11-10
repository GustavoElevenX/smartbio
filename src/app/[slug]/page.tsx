import type { Metadata } from "next";
import { PublicExperience } from "@/components/public-experience/public-experience";
import { PublicPresencePage } from "@/components/public-presence/public-presence-page";
import { PublicStructuredData } from "@/components/public-presence/public-structured-data";
import { resolvePublicSurface } from "@/features/presence/resolve-public-surface";
import { loadPublishedPublicProject } from "@/server/projects/load-public-project";
import { resolvePublicActivations } from "@/server/activations/public-activation-resolver";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveAppUrl } from "@/lib/app-url";
import { CampaignExperience } from "@/components/public-campaign/campaign-experience";
import { listPublishedCampaigns, resolveCampaignHome } from "@/server/activations/published-campaign-resolver";
import { publicActivationFromSnapshot } from "@/server/activations/public-activation-resolver";

const baseUrl = resolveAppUrl;
export const dynamic = "force-dynamic";
function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input; }

export async function generateMetadata({ params, searchParams }: PageProps<"/[slug]">): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const project = await loadPublishedPublicProject(slug);
  if (!project) return { title: "Experiência indisponível", robots: { index: false, follow: false } };
  const surface = resolvePublicSurface(project, value(query.entry), null);
  const campaign = !surface.entry ? resolveCampaignHome(await listPublishedCampaigns(createServiceClient(), project.id)) : null;
  if (campaign?.snapshot.snapshotVersion === 2 && campaign.snapshot.dynamicSurface) {
    const { dynamicSurface } = campaign.snapshot;
    const canonical = `${baseUrl()}/${project.slug}`;
    return { title: dynamicSurface.title, description: dynamicSurface.message || project.description,
      alternates: { canonical }, openGraph: { title: dynamicSurface.title, description: dynamicSurface.message, url: canonical, type: "website" } };
  }
  const page = surface.page;
  const title = page?.seoTitle || page?.title || project.name;
  const description = page?.seoDescription || page?.description || project.description || "Uma experiência criada com Sobe.";
  const canonical = `${baseUrl()}/${project.slug}`;
  const ogAsset = project.mediaAssets?.find((item) => item.id === page?.ogImageAssetId);
  const ogUrl = typeof ogAsset?.metadata?.publicUrl === "string" ? ogAsset.metadata.publicUrl : undefined;
  return { title, description, alternates: { canonical }, robots: page ? { index: page.isIndexable, follow: true } : { index: true, follow: true }, openGraph: { title, description, url: canonical, type: "website", images: ogUrl ? [{ url: ogUrl, alt: title }] : undefined } };
}

export default async function PublicProjectPage({ params, searchParams }: PageProps<"/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const project = await loadPublishedPublicProject(slug);
  const surface = project ? resolvePublicSurface(project, value(query.entry), null) : null;
  const campaign = project && !surface?.entry ? resolveCampaignHome(await listPublishedCampaigns(createServiceClient(), project.id)) : null;
  if (project && campaign?.snapshot.snapshotVersion === 2 && campaign.snapshot.dynamicSurface) {
    return <CampaignExperience project={project} surface={campaign.snapshot.dynamicSurface} activation={publicActivationFromSnapshot(campaign.snapshot)} />;
  }
  if (!project || !surface?.page || surface.mode === "conversion_direct") {
    return <PublicExperience slug={slug} initialProject={project} initialGoalId={surface?.conversionGoalId} initialStepId={surface?.targetStepId} />;
  }
  const publicActivations = await resolvePublicActivations(createServiceClient(), { projectId: project.id, entryPointId: surface.entry?.id, pageId: surface.page.id });
  const canonical = `${baseUrl()}/${project.slug}`;
  return <><PublicStructuredData project={project} page={surface.page} canonical={canonical} /><PublicPresencePage project={project} page={surface.page} publicActivations={publicActivations} /></>;
}
