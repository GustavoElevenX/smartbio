import "server-only";

import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { ProductionConfigurationError, WorkspaceRequiredError } from "@/server/auth/auth-errors";

function workspaceName(user: User) {
  const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return metadataName ? `Workspace de ${metadataName}` : "Meu workspace";
}

function workspaceSlug(user: User) {
  const emailPrefix = user.email?.split("@")[0] || "workspace";
  const normalized = emailPrefix.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 34) || "workspace";
  return `${normalized}-${user.id.slice(0, 8)}`;
}

export async function ensureUserWorkspace(user: User) {
  const supabase = createServiceClient();
  if (!supabase) throw new ProductionConfigurationError("A chave de serviço do Supabase é necessária para preparar o workspace.");

  const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : null;
  const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, full_name: fullName, email: user.email || null, last_sign_in_at: user.last_sign_in_at || null }, { onConflict: "id" });
  if (profileError) throw new WorkspaceRequiredError("Não foi possível preparar o perfil desta conta.");

  const { data: existingMembership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id,role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new WorkspaceRequiredError();
  if (existingMembership?.workspace_id) return { workspaceId: existingMembership.workspace_id, role: existingMembership.role as "owner" | "member" };

  const slug = workspaceSlug(user);
  let { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({ name: workspaceName(user), slug, owner_id: user.id })
    .select("id")
    .single();
  if (workspaceError) {
    const result = await supabase.from("workspaces").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    workspace = result.data;
    workspaceError = result.error;
  }
  if (workspaceError || !workspace) throw new WorkspaceRequiredError("Não foi possível criar o workspace inicial.");

  const { error: insertMembershipError } = await supabase.from("workspace_members").upsert(
    { workspace_id: workspace.id, user_id: user.id, role: "owner" },
    { onConflict: "workspace_id,user_id" },
  );
  if (insertMembershipError) throw new WorkspaceRequiredError("Não foi possível vincular a conta ao workspace.");
  const { error: planError } = await supabase.from("workspace_plan_assignments").upsert({ workspace_id: workspace.id, plan_key: "free", source: "system", status: "active" }, { onConflict: "workspace_id" });
  if (planError) throw new WorkspaceRequiredError("Não foi possível atribuir o plano inicial.");
  return { workspaceId: workspace.id, role: "owner" as const };
}
