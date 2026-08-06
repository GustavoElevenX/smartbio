import { notFound } from "next/navigation";
import { CrossWorkspaceProject } from "@/components/dashboard/cross-workspace-project";
import { assertProjectAccess } from "@/server/auth/project-access";
import { ProjectNotFoundError, WorkspaceAccessDeniedError } from "@/server/auth/auth-errors";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { createServiceClient } from "@/lib/supabase/server";

export default async function ProjectLayout({ children, params }: LayoutProps<"/app/projects/[projectId]">) {
  const { projectId } = await params;
  const actor = await requireAuthenticatedActor();
  try { await assertProjectAccess(actor, projectId, "read"); }
  catch (error) {
    if (error instanceof ProjectNotFoundError && actor.persistence === "database") {
      const client = createServiceClient();
      const { data: project } = client ? await client.from("projects").select("workspace_id").eq("id", projectId).maybeSingle() : { data: null };
      const { data: membership } = project && client ? await client.from("workspace_members").select("workspace_id,workspaces!inner(name)").eq("workspace_id", project.workspace_id).eq("user_id", actor.userId).maybeSingle() : { data: null };
      if (membership) {
        const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
        return <CrossWorkspaceProject workspaceId={membership.workspace_id} workspaceName={workspace.name} />;
      }
    }
    if (error instanceof ProjectNotFoundError || error instanceof WorkspaceAccessDeniedError) notFound();
    throw error;
  }
  return children;
}
