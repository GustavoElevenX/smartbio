import type { Metadata } from "next";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { VisualStudio } from "@/components/visual-engine/visual-studio";
export const metadata: Metadata = { title: "Artes com IA | SOBE" };
export default async function VisualsPage({ params }: PageProps<"/app/projects/[projectId]/visuals">) {
  const { projectId } = await params;
  const actor = await requireAuthenticatedActor({ requireConfirmedEmail: true });
  await assertProjectAccess(actor, projectId, "read");
  return <VisualStudio projectId={projectId} />;
}
