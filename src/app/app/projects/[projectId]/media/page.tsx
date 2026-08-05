import type { Metadata } from "next";
import { MediaLibrary } from "@/components/media-library/media-library";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
export const metadata: Metadata = { title: "Biblioteca de mídia" };
export default async function MediaPage({ params }: PageProps<"/app/projects/[projectId]/media">) { const { projectId } = await params; const actor = await requireAuthenticatedActor({ requireConfirmedEmail: true }); await assertProjectAccess(actor, projectId, "write"); return <MediaLibrary projectId={projectId} />; }
