import { PublicExperience } from "@/components/public-experience/public-experience";
import { getOptionalActor } from "@/server/auth/setup-actor";
import { loadProjectPreviewBySlug } from "@/server/projects/load-project-preview";
import { SurfaceViewMarker } from "@/components/product-lifecycle/surface-view-marker";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const actor = await getOptionalActor();
  const project = actor ? await loadProjectPreviewBySlug(actor, slug) : null;

  return <>
    {project ? <SurfaceViewMarker surface="public_preview" projectId={project.id} /> : null}
    <PublicExperience slug={slug} preview initialProject={project} />
  </>;
}
