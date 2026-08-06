import type { Metadata } from "next";
import { ProjectSourcesShell } from "@/components/project-sources/project-sources-shell";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";

export const metadata: Metadata = { title: "Fontes e importações" };

export default async function ProjectSourcesPage({ params }: PageProps<"/app/projects/[projectId]/sources">) {
  const { projectId } = await params;
  const actor = await requireAuthenticatedActor({ requireConfirmedEmail: true });
  await assertProjectAccess(actor, projectId, "write");
  return <ProjectSourcesShell projectId={projectId} />;
}
