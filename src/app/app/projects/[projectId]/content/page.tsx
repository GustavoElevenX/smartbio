import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { assertProjectAccess } from "@/server/auth/project-access";
import { ContentStudio } from "@/components/content-studio/content-studio";
export const metadata: Metadata = { title: "SOBE Conteúdo" };
export default async function ContentPage({ params }: PageProps<"/app/projects/[projectId]/content">) {
  if (process.env.NEXT_PUBLIC_FEATURE_CONTENT_STUDIO === "false") notFound();
  const { projectId } = await params; const actor = await requireAuthenticatedActor({ requireConfirmedEmail: true });
  await assertProjectAccess(actor, projectId, "read");
  return <ContentStudio projectId={projectId} />;
}
