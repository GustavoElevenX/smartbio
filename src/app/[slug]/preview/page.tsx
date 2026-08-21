import { PublicExperience } from "@/components/public-experience/public-experience";
import { getOptionalActor } from "@/server/auth/setup-actor";
import { loadProjectPreviewBySlug } from "@/server/projects/load-project-preview";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const actor = await getOptionalActor();
  const project = actor ? await loadProjectPreviewBySlug(actor, slug) : null;

  return (
    <PublicExperience slug={slug} preview initialProject={project} />
  );
}
