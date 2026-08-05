import { notFound } from "next/navigation";
import { assertProjectAccess } from "@/server/auth/project-access";
import { WorkspaceAccessDeniedError } from "@/server/auth/auth-errors";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";

export default async function ProjectLayout({ children, params }: LayoutProps<"/app/projects/[projectId]">) {
  const { projectId } = await params;
  try { await assertProjectAccess(await requireAuthenticatedActor(), projectId, "read"); }
  catch (error) { if (error instanceof WorkspaceAccessDeniedError) notFound(); throw error; }
  return children;
}
