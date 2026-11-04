import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ row: null as Record<string, unknown> | null, saved: null as Record<string, unknown> | null, remoteCalls: 0 }));
vi.mock("@/server/auth/project-access", () => ({ assertProjectAccess: vi.fn(async () => ({ id: "project-a", workspace_id: "workspace-a" })) }));
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from: (table: string) => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "social_connections" ? state.row : null }), single: async () => ({ data: state.row }),
    upsert: async (value: Record<string, unknown>) => { state.saved = value; state.row = { id: "connection-a", ...value }; return { error: null }; },
    update: (value: Record<string, unknown>) => { state.row = { ...state.row, ...value }; return query; } };
  return query;
} }) }));

import { connectInstagram, instagramStatus } from "@/server/content-studio/social";
import type { AuthenticatedActor } from "@/server/auth/setup-actor";
const actor: AuthenticatedActor = { userId: "owner-a", email: "owner@test.invalid", workspaceId: "workspace-a", role: "owner", persistence: "database", mode: "workspace" };

describe("Instagram OAuth", () => {
  beforeEach(() => { state.row = null; state.saved = null; state.remoteCalls = 0; process.env.COMPOSIO_API_KEY = "test-key"; process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID = "auth-test"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.COMPOSIO_API_KEY; delete process.env.COMPOSIO_INSTAGRAM_AUTH_CONFIG_ID; });

  it("cria Connect Link do projeto e não aceita retorno sem nonce válido", async () => {
    let callback = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      state.remoteCalls++;
      callback = JSON.parse(String(init?.body)).callback_url;
      return { ok: true, json: async () => ({ redirect_url: "https://connect.composio.dev/test", connected_account_id: "ca-test" }) };
    }));
    const linked = await connectInstagram(actor, "project-a", "https://staging.sobe.test");
    expect(linked.url).toBe("https://connect.composio.dev/test");
    expect(state.saved?.composio_user_id).toMatch(/^sobe_/);
    expect(callback).toContain("/app/projects/project-a/content?tab=instagram&state=");
    expect(await instagramStatus(actor, "project-a", "wrong-nonce")).toEqual({ status: "pending" });
    expect(state.remoteCalls).toBe(1);
  });

  it("confirma ACTIVE no provedor e verifica a conta profissional", async () => {
    let callback = "";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/connected_accounts/link")) { callback = JSON.parse(String(init?.body)).callback_url; return { ok: true, json: async () => ({ redirect_url: "https://connect.composio.dev/test", connected_account_id: "ca-test" }) }; }
      if (url.includes("/connected_accounts?")) return { ok: true, json: async () => ({ items: [{ id: "ca-test", user_id: state.row?.composio_user_id, status: "ACTIVE" }] }) };
      if (url.endsWith("/tools/execute/proxy")) return { ok: true, json: async () => ({ status: 200, data: { id: "12345", username: "sobe_teste", account_type: "BUSINESS" } }) };
      throw new Error(`Unexpected URL: ${url}`);
    }));
    await connectInstagram(actor, "project-a", "https://staging.sobe.test");
    const nonce = new URL(callback).searchParams.get("state")!;
    expect(await instagramStatus(actor, "project-a", nonce)).toMatchObject({ status: "active", displayName: "@sobe_teste" });
    expect(state.row?.connected_account_id).toBe("ca-test");
  });
});
