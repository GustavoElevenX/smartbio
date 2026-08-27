import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202608270061_rls_multi_tenant_hardening.sql",
  "utf8",
);
const v2Migration = readFileSync(
  "supabase/migrations/202608270062_rls_support_write_boundary.sql",
  "utf8",
);
const suite = readFileSync("tests/integration/rls-multi-tenant.test.ts", "utf8");

describe("P0-03 RLS contract", () => {
  it("defines a separate write boundary for scoped support grants", () => {
    expect(migration).toContain("is_workspace_writer");
    expect(migration).toContain("has_active_platform_support_access(target_workspace, 'write')");
    expect(migration).toContain("p0_03_projects_writer_update");
    expect(migration).toContain("revoke all on function public.is_workspace_member(uuid) from public, anon");
  });

  it("proves both directions with real anon-key sessions and adversarial mutations", () => {
    expect(suite).toContain("RLS_TEST_SUPABASE_ANON_KEY");
    expect(suite).toContain("ownerA.from(\"projects\")");
    expect(suite).toContain("ownerB.from(\"workspaces\")");
    expect(suite).toContain(".update({ workspace_id: fixture.workspaceB, project_id: fixture.projectB })");
    expect(suite).toContain("ownerA.rpc(\"publish_project\"");
    expect(suite).toContain("service-role client is intentionally limited");
  });

  it("adds a restrictive write policy for every legacy member mutation policy", () => {
    expect(v2Migration).toContain("p.polcmd <> 'r'");
    expect(v2Migration).toContain("is_workspace_member");
    expect(v2Migration).toContain("is_workspace_writer");
    expect(v2Migration).toContain("as restrictive for insert");
    expect(v2Migration).toContain("as restrictive for update");
    expect(v2Migration).toContain("as restrictive for delete");
  });
});
