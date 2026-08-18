import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202608180043_platform_acquisition_tracking.sql");
const endpoint = read("src/app/api/platform/track/route.ts");
const tracker = read("src/components/marketing/marketing-analytics.tsx");
const adminLayout = read("src/app/admin/layout.tsx");
const adminNav = read("src/components/platform-admin/admin-nav.tsx");
const adminGuard = read("src/server/platform-admin/require-platform-admin.ts");
const adminShell = read("src/components/platform-admin/admin-shell.tsx");
const acquisitionPage = read("src/app/admin/acquisition/page.tsx");
const workspaceDetail = read("src/app/admin/workspaces/[workspaceId]/page.tsx");

describe("platform acquisition tracking and admin", () => {
  it("isolates SOBE acquisition data from customer analytics", () => {
    expect(migration).toContain("create table public.platform_marketing_visitors");
    expect(migration).toContain("create table public.platform_marketing_sessions");
    expect(migration).toContain("create table public.platform_marketing_events");
    expect(migration).not.toMatch(/insert into public\.(visitor_sessions|analytics_events)/i);
  });

  it("keeps acquisition tables private and RPCs service-role only", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.platform_marketing_visitors");
    expect(migration).toContain("from public,anon,authenticated");
    expect(migration).toContain("to service_role");
  });

  it("uses signed first-party cookies and a rate-limited server endpoint", () => {
    expect(endpoint).toContain("PLATFORM_VISITOR_COOKIE");
    expect(endpoint).toContain("PLATFORM_PUBLIC_EVENT_NAMES");
    expect(endpoint).not.toContain("PLATFORM_EVENT_NAMES,");
    expect(endpoint).toContain("trackingCookieOptions");
    expect(endpoint).toContain("rateLimitRules.platformTracking");
    expect(endpoint).toContain("createServiceClient");
    expect(tracker).not.toMatch(/userId|workspaceId/);
  });

  it("protects admin and exposes the required operational sections", () => {
    expect(adminLayout).toContain("requirePlatformAdmin");
    expect(adminLayout).toContain('destination = "/login?next=/admin"');
    expect(adminLayout).not.toContain("notFound()");
    expect(adminGuard).toContain("if (authError && !isAuthSessionMissingError(authError))");
    expect(adminGuard).toContain("ProductionConfigurationError");
    expect(adminGuard).toContain("isAuthSessionMissingError(authError)");
    expect(adminGuard).toContain('const solePlatformAdminEmail = "l.gustavo2212@hotmail.com"');
    expect(adminGuard).toContain("user.email?.trim().toLowerCase() !== solePlatformAdminEmail");
    expect(adminNav).toContain("/admin/acquisition");
    expect(adminNav).toContain("/admin/users");
    expect(adminNav).toContain("/admin/workspaces");
    expect(adminNav).toContain("/admin/pages");
    expect(adminNav).toContain("/admin/plans");
    expect(adminNav).toContain("/admin/audit");
  });

  it("shows the administrative interface in Portuguese", () => {
    expect(adminShell).toContain("Administração da plataforma");
    expect(adminShell).toContain("Acesso restrito");
    expect(adminShell).not.toContain("Platform Admin");
    expect(adminNav).toContain("Espaços de trabalho");
    expect(acquisitionPage).not.toContain("First-touch");
    expect(workspaceDetail).not.toContain("Entitlements e uso");
    expect(workspaceDetail).not.toContain("Overrides");
    expect(workspaceDetail).not.toContain("← Workspaces");
  });
});
