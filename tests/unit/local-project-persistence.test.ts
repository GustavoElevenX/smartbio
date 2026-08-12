import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types";

const localProjects: Project[] = [];
const localStore = {
  getProjects: vi.fn(() => localProjects),
  getProject: vi.fn((id: string) => localProjects.find((project) => project.id === id)),
  saveProject: vi.fn((project: Project) => project),
  deleteProject: vi.fn(),
};
const createClient = vi.fn(() => { throw new Error("Supabase não deve ser acessado no modo local."); });

vi.mock("@/lib/local-store", () => ({ localStore }));
vi.mock("@/lib/runtime-mode", () => ({ canUseLocalStore: () => true }));
vi.mock("@/lib/supabase/client", () => ({ createClient, isSupabaseConfigured: () => true }));

const { projectRepository } = await import("@/lib/repositories/project-repository");

const project = {
  id: "local-project",
  workspaceId: "local-workspace",
  name: "Negócio local",
  slug: "negocio-local",
  description: "Rascunho local",
  status: "draft",
  primaryGoal: "Gerar contatos",
  primaryDestination: "WhatsApp",
  designSystem: {},
  brand: {},
  steps: [],
  capabilities: [],
  dataRequirements: [],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as unknown as Project;

describe("persistência de projetos no modo local", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não acessa o Supabase mesmo quando as credenciais estão configuradas", async () => {
    expect(await projectRepository.getProjects()).toBe(localProjects);
    await projectRepository.getProject(project.id);
    expect(await projectRepository.saveProject(project)).toBe(project);
    await projectRepository.deleteProject(project.id);

    expect(localStore.getProjects).toHaveBeenCalledOnce();
    expect(localStore.getProject).toHaveBeenCalledWith(project.id);
    expect(localStore.saveProject).toHaveBeenCalledWith(project);
    expect(localStore.deleteProject).toHaveBeenCalledWith(project.id);
    expect(createClient).not.toHaveBeenCalled();
  });
});
