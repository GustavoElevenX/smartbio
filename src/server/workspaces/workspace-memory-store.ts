import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

export interface MemoryWorkspaceActor {
  workspaceId: string;
  userId: string;
  email: string;
  role: "owner" | "member";
}

export interface MemoryWorkspace {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  account_status: "active";
}

export interface MemoryWorkspaceMember {
  user_id: string;
  role: "owner" | "member";
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface MemoryWorkspaceInvitation {
  id: string;
  email: string;
  role: "member";
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  acceptance_url: string;
}

interface MemoryWorkspaceInvitationRecord extends MemoryWorkspaceInvitation {
  token_hash: string;
}

type CreateMemoryWorkspaceInvitationResult =
  | { error: "existing_member" | "invitation_exists" }
  | { invitation: MemoryWorkspaceInvitation };

interface MemoryWorkspaceState {
  workspace: MemoryWorkspace;
  members: MemoryWorkspaceMember[];
  invitations: MemoryWorkspaceInvitationRecord[];
}

declare global {
  var __sobeMemoryWorkspaces: Map<string, MemoryWorkspaceState> | undefined;
}

const states: Map<string, MemoryWorkspaceState> =
  (globalThis.__sobeMemoryWorkspaces ??= new Map<string, MemoryWorkspaceState>());

function stateFor(actor: MemoryWorkspaceActor): MemoryWorkspaceState {
  const current = states.get(actor.workspaceId);
  if (current) return current;
  const created: MemoryWorkspaceState = {
    workspace: {
      id: actor.workspaceId,
      name: "Meu workspace",
      slug: "meu-workspace",
      settings: {},
      account_status: "active",
    },
    members: [
      {
        user_id: actor.userId,
        role: actor.role,
        created_at: new Date(0).toISOString(),
        profiles: {
          full_name: "Usuário local",
          email: actor.email,
          avatar_url: null,
        },
      },
    ],
    invitations: [],
  };
  states.set(actor.workspaceId, created);
  return created;
}

function expireInvitations(state: MemoryWorkspaceState) {
  const now = Date.now();
  state.invitations = state.invitations.map((invitation) =>
    invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= now
      ? { ...invitation, status: "expired" }
      : invitation,
  );
}

function publicInvitation(
  invitation: MemoryWorkspaceInvitationRecord,
): MemoryWorkspaceInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expires_at: invitation.expires_at,
    created_at: invitation.created_at,
    acceptance_url: invitation.acceptance_url,
  };
}

export function getMemoryWorkspace(actor: MemoryWorkspaceActor) {
  return structuredClone(stateFor(actor).workspace);
}

export function updateMemoryWorkspace(
  actor: MemoryWorkspaceActor,
  patch: Partial<Pick<MemoryWorkspace, "name" | "slug" | "settings">>,
) {
  const state = stateFor(actor);
  state.workspace = { ...state.workspace, ...patch };
  return structuredClone(state.workspace);
}

export function listMemoryWorkspaceMembers(actor: MemoryWorkspaceActor) {
  return structuredClone(stateFor(actor).members);
}

export function updateMemoryWorkspaceMember(
  actor: MemoryWorkspaceActor,
  userId: string,
  role: "member",
) {
  const state = stateFor(actor);
  const member = state.members.find((item) => item.user_id === userId);
  if (!member) return null;
  member.role = role;
  return structuredClone(member);
}

export function removeMemoryWorkspaceMember(actor: MemoryWorkspaceActor, userId: string) {
  const state = stateFor(actor);
  const previousLength = state.members.length;
  state.members = state.members.filter((member) => member.user_id !== userId);
  return state.members.length < previousLength;
}

export function listMemoryWorkspaceInvitations(actor: MemoryWorkspaceActor) {
  const state = stateFor(actor);
  expireInvitations(state);
  return state.invitations
    .filter((invitation) => invitation.status === "pending")
    .map((invitation) => structuredClone(publicInvitation(invitation)));
}

export function createMemoryWorkspaceInvitation(
  actor: MemoryWorkspaceActor,
  emailInput: string,
  origin: string,
): CreateMemoryWorkspaceInvitationResult {
  const state = stateFor(actor);
  expireInvitations(state);
  const email = emailInput.trim().toLowerCase();
  if (
    state.members.some(
      (member) => member.profiles.email?.toLowerCase() === email,
    )
  ) {
    return { error: "existing_member" as const };
  }
  if (
    state.invitations.some(
      (invitation) =>
        invitation.status === "pending" && invitation.email === email,
    )
  ) {
    return { error: "invitation_exists" as const };
  }
  const token = randomBytes(32).toString("base64url");
  const invitation: MemoryWorkspaceInvitationRecord = {
    id: randomUUID(),
    email,
    role: "member",
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    created_at: new Date().toISOString(),
    acceptance_url: `${origin}/invite/${token}`,
    token_hash: createHash("sha256").update(token).digest("hex"),
  };
  state.invitations.unshift(invitation);
  return { invitation: structuredClone(publicInvitation(invitation)) };
}

export function revokeMemoryWorkspaceInvitation(
  actor: MemoryWorkspaceActor,
  invitationId: string,
) {
  const state = stateFor(actor);
  const invitation = state.invitations.find(
    (item) => item.id === invitationId && item.status === "pending",
  );
  if (!invitation) return false;
  invitation.status = "revoked";
  return true;
}

export function acceptMemoryWorkspaceInvitation(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  for (const [workspaceId, state] of states) {
    expireInvitations(state);
    const invitation = state.invitations.find(
      (item) => item.token_hash === tokenHash && item.status === "pending",
    );
    if (!invitation) continue;
    invitation.status = "accepted";
    if (
      !state.members.some(
        (member) => member.profiles.email?.toLowerCase() === invitation.email,
      )
    ) {
      state.members.push({
        user_id: `local-invited-${invitation.id}`,
        role: "member",
        created_at: new Date().toISOString(),
        profiles: {
          full_name: invitation.email.split("@")[0] || "Membro convidado",
          email: invitation.email,
          avatar_url: null,
        },
      });
    }
    return { workspaceId };
  }
  return null;
}
