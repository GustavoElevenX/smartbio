import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * P0-05 real database suite. It mutates only isolated QA fixtures and requires:
 * SCHEDULING_TEST_ALLOW_REMOTE=true plus the INTEGRATION_TEST_* variables.
 */
const enabled =
  process.env.SCHEDULING_TEST_ALLOW_REMOTE === "true" &&
  Boolean(
    process.env.INTEGRATION_TEST_SUPABASE_URL &&
      process.env.INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY &&
      process.env.INTEGRATION_TEST_USER_ID,
  );

const suite = enabled ? describe : describe.skip;

type Fixture = {
  workspaceA: string;
  workspaceB: string;
  projectA: string;
  projectB: string;
  manualService: string;
  instantService: string;
  otherService: string;
  resourceA: string;
  instantResource: string;
  otherServiceResource: string;
  resourceB: string;
  date: string;
};

let database: SupabaseClient;
let fixture: Fixture | undefined;

function slot(date: string, hour: number, minute = 0) {
  return `${date}T${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00.000Z`;
}

function request(input: {
  project?: string;
  service?: string;
  resource?: string;
  startsAt: string;
  idempotencyKey?: string;
  session?: string;
}) {
  if (!fixture) throw new Error("fixture_not_ready");
  return database.rpc("create_booking_request", {
    target_project: input.project || fixture.projectA,
    request_session_key: input.session || `qa-session-${crypto.randomUUID()}`,
    request_idempotency_key: input.idempotencyKey || `qa-idem-${crypto.randomUUID()}`,
    target_service: input.service || fixture.manualService,
    target_resource: input.resource || fixture.resourceA,
    requested_start: input.startsAt,
    requested_visitor_data: { name: "Visitante QA P0-05" },
  });
}

suite("P0-05 scheduling native boundary (real Supabase)", () => {
  beforeAll(async () => {
    database = createClient(
      process.env.INTEGRATION_TEST_SUPABASE_URL!,
      process.env.INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const suffix = crypto.randomUUID().slice(0, 8);
    const ownerId = process.env.INTEGRATION_TEST_USER_ID!;
    const workspaces = await database.from("workspaces").insert([
      { name: `Scheduling QA A ${suffix}`, slug: `scheduling-qa-a-${suffix}`, owner_id: ownerId },
      { name: `Scheduling QA B ${suffix}`, slug: `scheduling-qa-b-${suffix}`, owner_id: ownerId },
    ]).select("id,slug");
    if (workspaces.error || workspaces.data?.length !== 2) throw workspaces.error || new Error("workspace_fixture_failed");
    const workspaceA = workspaces.data.find((row) => row.slug === `scheduling-qa-a-${suffix}`)!.id;
    const workspaceB = workspaces.data.find((row) => row.slug === `scheduling-qa-b-${suffix}`)!.id;

    const projects = await database.from("projects").insert([
      { name: `Scheduling QA A ${suffix}`, slug: `scheduling-project-a-${suffix}`, workspace_id: workspaceA, status: "published", published_at: new Date().toISOString() },
      { name: `Scheduling QA B ${suffix}`, slug: `scheduling-project-b-${suffix}`, workspace_id: workspaceB, status: "published", published_at: new Date().toISOString() },
    ]).select("id,workspace_id");
    if (projects.error || projects.data?.length !== 2) throw projects.error || new Error("project_fixture_failed");
    const projectA = projects.data.find((row) => row.workspace_id === workspaceA)!.id;
    const projectB = projects.data.find((row) => row.workspace_id === workspaceB)!.id;

    const services = await database.from("schedulable_services").insert([
      { project_id: projectA, name: "Manual QA", duration_minutes: 30, confirmation_mode: "manual_approval" },
      { project_id: projectA, name: "Instant QA", duration_minutes: 45, confirmation_mode: "instant" },
      { project_id: projectA, name: "Other QA", duration_minutes: 30, confirmation_mode: "manual_approval" },
      { project_id: projectB, name: "Tenant B QA", duration_minutes: 30, confirmation_mode: "instant" },
    ]).select("id,name");
    if (services.error || services.data?.length !== 4) throw services.error || new Error("service_fixture_failed");
    const service = (name: string) => services.data.find((row) => row.name === name)!.id;

    const resources = await database.from("resources").insert([
      { project_id: projectA, name: "Resource A QA", resource_type: "room" },
      { project_id: projectA, name: "Instant Resource QA", resource_type: "professional" },
      { project_id: projectA, name: "Other Service Resource QA", resource_type: "asset" },
      { project_id: projectB, name: "Resource B QA", resource_type: "room" },
    ]).select("id,name");
    if (resources.error || resources.data?.length !== 4) throw resources.error || new Error("resource_fixture_failed");
    const resource = (name: string) => resources.data.find((row) => row.name === name)!.id;
    const manualService = service("Manual QA");
    const instantService = service("Instant QA");
    const otherService = service("Other QA");
    const resourceA = resource("Resource A QA");
    const instantResource = resource("Instant Resource QA");
    const otherServiceResource = resource("Other Service Resource QA");
    const resourceB = resource("Resource B QA");

    const bindings = await database.from("service_resources").insert([
      { service_id: manualService, resource_id: resourceA },
      { service_id: instantService, resource_id: instantResource },
      { service_id: otherService, resource_id: otherServiceResource },
    ]);
    if (bindings.error) throw bindings.error;

    const future = new Date(Date.now() + 14 * 86_400_000);
    const date = future.toISOString().slice(0, 10);
    const weekday = future.getUTCDay();
    const rules = await database.from("availability_rules").insert([
      { project_id: projectA, resource_id: resourceA, weekday, starts_at: "09:00", ends_at: "17:00", timezone: "UTC", slot_interval_minutes: 30 },
      { project_id: projectA, resource_id: instantResource, weekday, starts_at: "09:00", ends_at: "17:00", timezone: "UTC", slot_interval_minutes: 30 },
      { project_id: projectA, resource_id: otherServiceResource, weekday, starts_at: "09:00", ends_at: "17:00", timezone: "UTC", slot_interval_minutes: 30 },
    ]);
    if (rules.error) throw rules.error;
    const blocked = await database.from("availability_exceptions").insert({
      project_id: projectA,
      resource_id: resourceA,
      starts_at: slot(date, 11),
      ends_at: slot(date, 11, 30),
      is_available: false,
      reason: "P0-05 QA block",
    });
    if (blocked.error) throw blocked.error;

    fixture = { workspaceA, workspaceB, projectA, projectB, manualService, instantService, otherService, resourceA, instantResource, otherServiceResource, resourceB, date };
  }, 60_000);

  afterAll(async () => {
    if (!fixture) return;
    await database.from("workspaces").delete().in("id", [fixture.workspaceA, fixture.workspaceB]);
  });

  it("derives manual/instant status and duration from each service", async () => {
    const manual = await request({ startsAt: slot(fixture!.date, 9) });
    expect(manual.error).toBeNull();
    expect(manual.data).toMatchObject({ status: "pending", confirmation_mode: "manual_approval" });
    expect(new Date(manual.data.ends_at).getTime() - new Date(manual.data.starts_at).getTime()).toBe(30 * 60_000);

    const instant = await request({ service: fixture!.instantService, resource: fixture!.instantResource, startsAt: slot(fixture!.date, 9) });
    expect(instant.error).toBeNull();
    expect(instant.data).toMatchObject({ status: "confirmed", confirmation_mode: "instant" });
    expect(new Date(instant.data.ends_at).getTime() - new Date(instant.data.starts_at).getTime()).toBe(45 * 60_000);
  });

  it("rejects resources from another service and another tenant", async () => {
    const otherService = await request({ resource: fixture!.otherServiceResource, startsAt: slot(fixture!.date, 10) });
    expect(otherService.error?.code).toBe("P0003");
    const otherTenant = await request({ resource: fixture!.resourceB, startsAt: slot(fixture!.date, 10) });
    expect(otherTenant.error?.code).toBe("P0003");
  });

  it("rejects known service ids from another tenant", async () => {
    const result = await request({ project: fixture!.projectB, service: fixture!.manualService, resource: fixture!.resourceB, startsAt: slot(fixture!.date, 10) });
    expect(result.error?.code).toBe("P0002");
  });

  it("rejects outside, blocked, and already occupied slots", async () => {
    const outside = await request({ startsAt: slot(fixture!.date, 18) });
    expect(outside.error?.code).toBe("P0004");
    const blocked = await request({ startsAt: slot(fixture!.date, 11) });
    expect(blocked.error?.code).toBe("P0004");
    const first = await request({ startsAt: slot(fixture!.date, 12) });
    expect(first.error).toBeNull();
    const conflict = await request({ startsAt: slot(fixture!.date, 12) });
    expect(conflict.error?.code).toBe("P0001");
  });

  it("returns the original booking only for an identical idempotent retry", async () => {
    const key = `qa-idem-${crypto.randomUUID()}`;
    const session = `qa-session-${crypto.randomUUID()}`;
    const first = await request({ startsAt: slot(fixture!.date, 14), idempotencyKey: key, session });
    const retry = await request({ startsAt: slot(fixture!.date, 14), idempotencyKey: key, session });
    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data.id).toBe(first.data.id);
    const forged = await request({ startsAt: slot(fixture!.date, 14, 30), idempotencyKey: key, session });
    expect(forged.error?.code).toBe("P0005");
  });

  it("allows only one winner for two concurrent requests to the same slot", async () => {
    const startsAt = slot(fixture!.date, 15);
    const results = await Promise.all([
      request({ startsAt, session: "qa-visitor-one" }),
      request({ startsAt, session: "qa-visitor-two" }),
    ]);
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error?.code === "P0001")).toHaveLength(1);
  });
});
