import type { Metadata } from "next";
import { CommercialDataShell } from "@/components/commercial-data/commercial-data-shell";
import { assertProjectAccess } from "@/server/auth/project-access";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";

export const metadata: Metadata = { title: "Dados comerciais" };

export default async function CommercialDataPage({ params }: PageProps<"/app/projects/[projectId]/data">) {
  const { projectId } = await params;
  const actor = await requireAuthenticatedActor({ requireConfirmedEmail: true });
  await assertProjectAccess(actor, projectId, "write");
  return <CommercialDataShell projectId={projectId} />;
}
