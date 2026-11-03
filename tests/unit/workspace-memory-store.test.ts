import { describe, expect, it } from "vitest";
import {
  acceptMemoryWorkspaceInvitation,
  createMemoryWorkspaceInvitation,
  getMemoryWorkspace,
  listMemoryWorkspaceInvitations,
  listMemoryWorkspaceMembers,
  updateMemoryWorkspace,
  type MemoryWorkspaceActor,
  revokeMemoryWorkspaceInvitation,
} from "@/server/workspaces/workspace-memory-store";

function actor(id: string): MemoryWorkspaceActor {
  return {
    workspaceId: `workspace-${id}`,
    userId: `owner-${id}`,
    email: `owner-${id}@sobe.test`,
    role: "owner",
  };
}

describe("workspace local", () => {
  it("mantém as alterações entre leituras", () => {
    const localActor = actor("persistence");
    updateMemoryWorkspace(localActor, {
      name: "Equipe Comercial",
      slug: "equipe-comercial",
    });

    expect(getMemoryWorkspace(localActor)).toMatchObject({
      name: "Equipe Comercial",
      slug: "equipe-comercial",
    });
  });

  it("cria, impede duplicidade e cancela convites", () => {
    const localActor = actor("invitations");
    const created = createMemoryWorkspaceInvitation(
      localActor,
      "Pessoa@Empresa.com",
      "http://127.0.0.1:3000",
    );
    expect(created).toHaveProperty("invitation");
    if (!("invitation" in created)) throw new Error("Convite não criado.");
    expect(created.invitation.email).toBe("pessoa@empresa.com");
    expect(created.invitation.acceptance_url).toContain("/invite/");

    expect(
      createMemoryWorkspaceInvitation(
        localActor,
        "pessoa@empresa.com",
        "http://127.0.0.1:3000",
      ),
    ).toEqual({ error: "invitation_exists" });
    expect(listMemoryWorkspaceInvitations(localActor)).toHaveLength(1);
    expect(revokeMemoryWorkspaceInvitation(localActor, created.invitation.id)).toBe(true);
    expect(listMemoryWorkspaceInvitations(localActor)).toHaveLength(0);
  });

  it("aceita o link e inclui o convidado como membro", () => {
    const localActor = actor("acceptance");
    const created = createMemoryWorkspaceInvitation(
      localActor,
      "novo-membro@sobe.test",
      "http://127.0.0.1:3000",
    );
    if (!("invitation" in created)) throw new Error("Convite não criado.");
    const token = created.invitation.acceptance_url.split("/invite/")[1];

    expect(acceptMemoryWorkspaceInvitation(token)).toEqual({
      workspaceId: localActor.workspaceId,
    });
    expect(listMemoryWorkspaceInvitations(localActor)).toHaveLength(0);
    expect(listMemoryWorkspaceMembers(localActor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "member",
          profiles: expect.objectContaining({ email: "novo-membro@sobe.test" }),
        }),
      ]),
    );
  });

  it("não convida quem já pertence ao workspace", () => {
    const localActor = actor("existing-member");
    expect(
      createMemoryWorkspaceInvitation(
        localActor,
        localActor.email,
        "http://127.0.0.1:3000",
      ),
    ).toEqual({ error: "existing_member" });
  });
});
