import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("launch hardening", () => {
  it("keeps the production overview server-first and demo-free", () => {
    const page = readFileSync("src/app/app/page.tsx", "utf8");
    const overview = readFileSync("src/components/dashboard/overview.tsx", "utf8");
    expect(page).toContain("getWorkspaceOperationalOverview");
    expect(overview).not.toContain("localStore");
    expect(overview).not.toContain("smart.bio");
    expect(overview).not.toContain("demo-vertice");
  });

  it("generates QR locally", () => {
    const qr = readFileSync("src/components/entry-points/entry-point-qr.tsx", "utf8");
    expect(qr).toContain('from "qrcode"');
    expect(qr).not.toContain("api.qrserver.com");
  });

  it("does not count duplicate conversion transitions", () => {
    const route = readFileSync("src/app/api/projects/[projectId]/opportunities/route.ts", "utf8");
    expect(route).toContain('current?.status !== "converted"');
    expect(route).toContain("project_version_id");
  });
});
