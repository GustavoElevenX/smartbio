import "server-only";
import { syncProjectRows } from "@/server/commercial-data/repository-utils";
import type { ProjectPolicy } from "@/types";
export async function savePolicies(projectId: string, policies: ProjectPolicy[]) { await syncProjectRows("project_policies", projectId, policies.map((item) => ({ id: item.id, project_id: projectId, policy_type: item.type, title: item.title, content: item.content, is_active: item.isActive, settings: item.settings }))); }
