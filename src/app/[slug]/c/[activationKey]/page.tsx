import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignExperience } from "@/components/public-campaign/campaign-experience";
import { loadPublishedPublicProject } from "@/server/projects/load-public-project";
import { createServiceClient } from "@/lib/supabase/server";
import { listPublishedCampaigns, resolveExclusiveCampaign } from "@/server/activations/published-campaign-resolver";
import { publicActivationFromSnapshot } from "@/server/activations/public-activation-resolver";
import { resolveAppUrl } from "@/lib/app-url";
import { campaignPresentation } from "@/features/activations/campaign-presentation";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[slug]/c/[activationKey]">): Promise<Metadata> {
  const { slug, activationKey } = await params;
  const project = await loadPublishedPublicProject(slug);
  if (!project) return { title: "Campanha indisponível", robots: { index: false, follow: false } };
  const campaign = resolveExclusiveCampaign(await listPublishedCampaigns(createServiceClient(), project.id), activationKey);
  if (!campaign || campaign.snapshot.snapshotVersion !== 2 || !campaign.snapshot.dynamicSurface) {
    return { title: "Campanha indisponível", robots: { index: false, follow: false } };
  }
  const surface = campaign.snapshot.dynamicSurface;
  const content = campaignPresentation(surface, publicActivationFromSnapshot(campaign.snapshot));
  const canonical = `${resolveAppUrl()}/${project.slug}/c/${activationKey}`;
  return { title: content.title, description: content.message || project.description,
    alternates: { canonical }, openGraph: { title: content.title, description: content.message, url: canonical, type: "website" } };
}

export default async function CampaignPage({ params }: PageProps<"/[slug]/c/[activationKey]">) {
  const { slug, activationKey } = await params;
  const project = await loadPublishedPublicProject(slug);
  if (!project) notFound();
  const campaign = resolveExclusiveCampaign(await listPublishedCampaigns(createServiceClient(), project.id), activationKey);
  if (!campaign || campaign.snapshot.snapshotVersion !== 2 || !campaign.snapshot.dynamicSurface) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f8fa] p-6 text-center text-[#07172f]"><div><h1 className="text-3xl font-extrabold">Esta campanha não está disponível.</h1><p className="mt-3">Veja a experiência do negócio.</p><Link href={`/${project.slug}?view=standard`} className="focus-ring mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#0054fc] px-5 font-bold text-white">Ver experiência do negócio</Link></div></main>;
  }
  return <CampaignExperience project={project} surface={campaign.snapshot.dynamicSurface} activation={publicActivationFromSnapshot(campaign.snapshot)} />;
}
