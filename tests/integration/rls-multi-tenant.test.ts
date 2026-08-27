import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * P0-03 real-session suite.  The service-role client is intentionally limited
 * to fixture setup/teardown; every assertion uses anon key + a real JWT.
 *
 * Required for execution against a test/staging project:
 * RLS_TEST_ALLOW_REMOTE=true
 * RLS_TEST_SUPABASE_URL, RLS_TEST_SUPABASE_ANON_KEY,
 * RLS_TEST_SUPABASE_SERVICE_ROLE_KEY
 */
const enabled =
  process.env.RLS_TEST_ALLOW_REMOTE === "true" &&
  Boolean(
    process.env.RLS_TEST_SUPABASE_URL &&
      process.env.RLS_TEST_SUPABASE_ANON_KEY &&
      process.env.RLS_TEST_SUPABASE_SERVICE_ROLE_KEY,
  );

type Fixture = {
  ownerA: string;
  ownerB: string;
  memberA: string;
  supportRead: string;
  supportWrite: string;
  expiredSupport: string;
  revokedSupport: string;
  workspaceA: string;
  workspaceB: string;
  projectA: string;
  projectB: string;
  publicProject: string;
  leadB: string;
  opportunityB: string;
  catalogItemA: string;
  versionA: string;
};

let admin: SupabaseClient;
let fixture: Fixture;
const clients = new Map<string, SupabaseClient>();

async function createUser(suffix: string) {
  const email = `rls-${suffix}-${crypto.randomUUID()}@sobe.test`;
  const password = `Rls-${crypto.randomUUID()}-!a9`;
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error || !result.data.user) throw result.error || new Error("user fixture failed");
  return { id: result.data.user.id, email, password };
}

async function signIn(user: { email: string; password: string }) {
  const client = createClient(
    process.env.RLS_TEST_SUPABASE_URL!,
    process.env.RLS_TEST_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await client.auth.signInWithPassword(user);
  if (result.error) throw result.error;
  clients.set(user.email, client);
  return client;
}

const suite = enabled ? describe : describe.skip;

suite("P0-03 RLS / multi-tenant isolation (real Supabase)", () => {
  let ownerA: SupabaseClient;
  let ownerB: SupabaseClient;
  let memberA: SupabaseClient;
  let supportRead: SupabaseClient;
  let supportWrite: SupabaseClient;
  let expiredSupport: SupabaseClient;
  let revokedSupport: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(
      process.env.RLS_TEST_SUPABASE_URL!,
      process.env.RLS_TEST_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const [a, b, member, supportReadUser, supportWriteUser, expiredSupportUser, revokedSupportUser] = await Promise.all([
      createUser("owner-a"),
      createUser("owner-b"),
      createUser("member-a"),
      createUser("support-read"),
      createUser("support-write"),
      createUser("support-expired"),
      createUser("support-revoked"),
    ]);
    const suffix = crypto.randomUUID().slice(0, 8);
    const workspaces = await admin
      .from("workspaces")
      .insert([
        { name: `RLS QA A ${suffix}`, slug: `rls-qa-a-${suffix}`, owner_id: a.id },
        { name: `RLS QA B ${suffix}`, slug: `rls-qa-b-${suffix}`, owner_id: b.id },
      ])
      .select("id,owner_id");
    if (workspaces.error || !workspaces.data || workspaces.data.length !== 2)
      throw workspaces.error || new Error("workspace fixture failed");
    const workspaceA = workspaces.data.find((row) => row.owner_id === a.id)!.id;
    const workspaceB = workspaces.data.find((row) => row.owner_id === b.id)!.id;
    const memberships = await admin.from("workspace_members").insert([
      { workspace_id: workspaceA, user_id: a.id, role: "owner" },
      { workspace_id: workspaceA, user_id: member.id, role: "member" },
      { workspace_id: workspaceB, user_id: b.id, role: "owner" },
    ]);
    if (memberships.error) throw memberships.error;
    const admins = await admin.from("platform_admins").insert([
      { user_id: supportReadUser.id, role: "support_admin", is_active: true },
      { user_id: supportWriteUser.id, role: "support_admin", is_active: true },
      { user_id: expiredSupportUser.id, role: "support_admin", is_active: true },
      { user_id: revokedSupportUser.id, role: "support_admin", is_active: true },
    ]);
    if (admins.error) throw admins.error;
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const expiredAt = new Date(Date.now() - 60_000).toISOString();
    const supportSessions = await admin.from("platform_support_sessions").insert([
      { admin_user_id: supportReadUser.id, workspace_id: workspaceA, reason: "RLS QA read-only", status: "active", started_at: startedAt, expires_at: expiresAt },
      { admin_user_id: supportWriteUser.id, workspace_id: workspaceA, reason: "RLS QA write grant", status: "active", started_at: startedAt, expires_at: expiresAt },
      { admin_user_id: expiredSupportUser.id, workspace_id: workspaceA, reason: "RLS QA expired", status: "active", started_at: new Date(Date.now() - 120_000).toISOString(), expires_at: expiredAt },
      { admin_user_id: revokedSupportUser.id, workspace_id: workspaceA, reason: "RLS QA revoked", status: "active", started_at: startedAt, expires_at: expiresAt },
    ]).select("id,admin_user_id");
    if (supportSessions.error || !supportSessions.data || supportSessions.data.length !== 4) throw supportSessions.error || new Error("support session fixture failed");
    const sessionFor = (userId: string) => supportSessions.data.find((row) => row.admin_user_id === userId)!.id;
    const grants = await admin.from("platform_support_grants").insert([
      { support_session_id: sessionFor(supportReadUser.id), admin_user_id: supportReadUser.id, workspace_id: workspaceA, can_read: true, can_write: false, expires_at: expiresAt },
      { support_session_id: sessionFor(supportWriteUser.id), admin_user_id: supportWriteUser.id, workspace_id: workspaceA, can_read: true, can_write: true, expires_at: expiresAt },
      { support_session_id: sessionFor(expiredSupportUser.id), admin_user_id: expiredSupportUser.id, workspace_id: workspaceA, can_read: true, can_write: true, expires_at: expiredAt },
      { support_session_id: sessionFor(revokedSupportUser.id), admin_user_id: revokedSupportUser.id, workspace_id: workspaceA, can_read: true, can_write: true, expires_at: expiresAt, revoked_at: new Date().toISOString() },
    ]);
    if (grants.error) throw grants.error;
    const projects = await admin
      .from("projects")
      .insert([
        { name: `RLS QA Project A ${suffix}`, slug: `rls-qa-project-a-${suffix}`, workspace_id: workspaceA, status: "draft" },
        { name: `RLS QA Project B ${suffix}`, slug: `rls-qa-project-b-${suffix}`, workspace_id: workspaceB, status: "draft" },
        { name: `RLS QA Public ${suffix}`, slug: `rls-qa-public-${suffix}`, workspace_id: workspaceA, status: "published", published_at: new Date().toISOString() },
      ])
      .select("id,workspace_id");
    if (projects.error || !projects.data || projects.data.length !== 3)
      throw projects.error || new Error("project fixture failed");
    const projectA = projects.data.find((row) => row.workspace_id === workspaceA)!.id;
    const projectB = projects.data.find((row) => row.workspace_id === workspaceB)!.id;
    const publicProject = projects.data.find((row) => row.workspace_id === workspaceA && row.id !== projectA)!.id;
    const lead = await admin
      .from("leads")
      .insert({ workspace_id: workspaceB, project_id: projectB, name: "RLS QA private lead", email: "qa-b@sobe.test" })
      .select("id")
      .single();
    if (lead.error || !lead.data) throw lead.error || new Error("lead fixture failed");
    const opportunity = await admin
      .from("commercial_opportunities")
      .insert({ workspace_id: workspaceB, project_id: projectB, source_type: "lead", source_id: `rls-qa-${suffix}`, title: "RLS QA opportunity" })
      .select("id")
      .single();
    if (opportunity.error || !opportunity.data) throw opportunity.error || new Error("opportunity fixture failed");
    const category = await admin.from("catalog_categories").insert({ project_id: projectA, name: "RLS QA category" }).select("id").single();
    if (category.error || !category.data) throw category.error || new Error("catalog category fixture failed");
    const item = await admin.from("catalog_items").insert({ project_id: projectA, category_id: category.data.id, name: "RLS QA item", price: 10 }).select("id").single();
    if (item.error || !item.data) throw item.error || new Error("catalog item fixture failed");
    const version = await admin.from("project_versions").insert({ project_id: projectA, version_number: 1, snapshot: { id: projectA, qa: true }, created_by: a.id }).select("id").single();
    if (version.error || !version.data) throw version.error || new Error("version fixture failed");
    fixture = { ownerA: a.id, ownerB: b.id, memberA: member.id, supportRead: supportReadUser.id, supportWrite: supportWriteUser.id, expiredSupport: expiredSupportUser.id, revokedSupport: revokedSupportUser.id, workspaceA, workspaceB, projectA, projectB, publicProject, leadB: lead.data.id, opportunityB: opportunity.data.id, catalogItemA: item.data.id, versionA: version.data.id };
    ownerA = await signIn(a);
    ownerB = await signIn(b);
    memberA = await signIn(member);
    supportRead = await signIn(supportReadUser);
    supportWrite = await signIn(supportWriteUser);
    expiredSupport = await signIn(expiredSupportUser);
    revokedSupport = await signIn(revokedSupportUser);
  });

  it("owners read only their own tenant in both directions", async () => {
    const aOwn = await ownerA.from("workspaces").select("id").eq("id", fixture.workspaceA);
    const aOther = await ownerA.from("workspaces").select("id").eq("id", fixture.workspaceB);
    const bOwn = await ownerB.from("workspaces").select("id").eq("id", fixture.workspaceB);
    const bOther = await ownerB.from("workspaces").select("id").eq("id", fixture.workspaceA);
    expect(aOwn.data).toHaveLength(1);
    expect(aOther.data).toEqual([]);
    expect(bOwn.data).toHaveLength(1);
    expect(bOther.data).toEqual([]);
  });

  it("blocks known-ID reads and all cross-tenant mutations", async () => {
    const readProject = await ownerA.from("projects").select("id").eq("id", fixture.projectB);
    expect(readProject.data).toEqual([]);
    const updateProject = await ownerA.from("projects").update({ name: "must-not-change" }).eq("id", fixture.projectB).select("id");
    expect(updateProject.data || []).toEqual([]);
    const deleteLead = await ownerA.from("leads").delete().eq("id", fixture.leadB).select("id");
    expect(deleteLead.data || []).toEqual([]);
    const insertProject = await ownerA.from("projects").insert({ workspace_id: fixture.workspaceB, name: "cross tenant", slug: `rls-cross-${crypto.randomUUID()}` }).select("id");
    expect(insertProject.data || []).toEqual([]);
    const fkEscalation = await ownerA.from("commercial_opportunities").update({ workspace_id: fixture.workspaceB, project_id: fixture.projectB }).eq("id", fixture.opportunityB).select("id");
    expect(fkEscalation.data || []).toEqual([]);
    const rpc = await ownerA.rpc("publish_project", { target_project: fixture.projectB });
    expect(rpc.data).toBeNull();
    expect(rpc.error).toBeTruthy();
  });

  it("keeps anonymous private data hidden while preserving explicit publication", async () => {
    const anonymous = createClient(process.env.RLS_TEST_SUPABASE_URL!, process.env.RLS_TEST_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const privateProject = await anonymous.from("projects").select("id").eq("id", fixture.projectB);
    const privateLead = await anonymous.from("leads").select("id").eq("id", fixture.leadB);
    const publishedProject = await anonymous.from("projects").select("id,status").eq("id", fixture.publicProject);
    expect(privateProject.data || []).toEqual([]);
    expect(privateLead.data || []).toEqual([]);
    expect(publishedProject.data).toEqual([{ id: fixture.publicProject, status: "published" }]);
  });

  it("keeps member scoped to workspace A and owner-only project deletion", async () => {
    const own = await memberA.from("projects").select("id").eq("id", fixture.projectA);
    const other = await memberA.from("projects").select("id").eq("id", fixture.projectB);
    expect(own.data).toHaveLength(1);
    expect(other.data).toEqual([]);
    const deleteAttempt = await memberA.from("projects").delete().eq("id", fixture.projectA).select("id");
    expect(deleteAttempt.data || []).toEqual([]);
  });

  it("allows support read-only to read but blocks every mutation path", async () => {
    const own = await supportRead.from("catalog_items").select("id").eq("id", fixture.catalogItemA);
    const other = await supportRead.from("projects").select("id").eq("id", fixture.projectB);
    expect(own.data).toHaveLength(1);
    expect(other.data).toEqual([]);
    const insert = await supportRead.from("catalog_items").insert({ project_id: fixture.projectA, name: "must-not-insert" }).select("id");
    const update = await supportRead.from("catalog_items").update({ name: "must-not-update" }).eq("id", fixture.catalogItemA).select("id");
    const remove = await supportRead.from("catalog_items").delete().eq("id", fixture.catalogItemA).select("id");
    expect(insert.data || []).toEqual([]);
    expect(update.data || []).toEqual([]);
    expect(remove.data || []).toEqual([]);
    const publish = await supportRead.rpc("publish_project", { target_project: fixture.projectA });
    const restore = await supportRead.rpc("restore_project_version", { target_version: fixture.versionA });
    expect(publish.error).toBeTruthy();
    expect(restore.error).toBeTruthy();
  });

  it("allows support write only inside its grant scope", async () => {
    const updateOwn = await supportWrite.from("catalog_items").update({ name: "support-write-ok" }).eq("id", fixture.catalogItemA).select("id,name");
    expect(updateOwn.data).toEqual([{ id: fixture.catalogItemA, name: "support-write-ok" }]);
    const updateOther = await supportWrite.from("projects").update({ name: "must-not-cross-tenant" }).eq("id", fixture.projectB).select("id");
    expect(updateOther.data || []).toEqual([]);
  });

  it("removes read and write access for expired and revoked grants", async () => {
    const expiredRead = await expiredSupport.from("projects").select("id").eq("id", fixture.projectA);
    const expiredWrite = await expiredSupport.from("catalog_items").update({ name: "expired" }).eq("id", fixture.catalogItemA).select("id");
    const revokedRead = await revokedSupport.from("projects").select("id").eq("id", fixture.projectA);
    const revokedWrite = await revokedSupport.from("catalog_items").delete().eq("id", fixture.catalogItemA).select("id");
    expect(expiredRead.data || []).toEqual([]);
    expect(expiredWrite.data || []).toEqual([]);
    expect(revokedRead.data || []).toEqual([]);
    expect(revokedWrite.data || []).toEqual([]);
  });

  afterAll(async () => {
    if (!admin || !fixture) return;
    await admin.from("workspaces").delete().in("id", [fixture.workspaceA, fixture.workspaceB]);
    await Promise.all([fixture.ownerA, fixture.ownerB, fixture.memberA, fixture.supportRead, fixture.supportWrite, fixture.expiredSupport, fixture.revokedSupport].map((id) => admin.auth.admin.deleteUser(id)));
  });
});

if (!enabled) {
  console.log("NOT_RUN: set RLS_TEST_ALLOW_REMOTE=true plus RLS_TEST_SUPABASE_URL, RLS_TEST_SUPABASE_ANON_KEY and RLS_TEST_SUPABASE_SERVICE_ROLE_KEY");
}
