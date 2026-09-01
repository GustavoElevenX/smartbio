import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookingRequestSchema } from "@/lib/validation/schemas";
import {
  BookingBoundaryError,
  resolveBookingIntent,
  resolveSchedulingSelection,
} from "@/server/scheduling/booking-boundary";
import type { Booking, ConfirmationMode, Project } from "@/types";

const migration = readFileSync(
  "supabase/migrations/202608310063_scheduling_native_v1_hardening.sql",
  "utf8",
);
const bookingRoute = readFileSync("src/app/api/public/bookings/route.ts", "utf8");
const publicExperience = readFileSync(
  "src/components/public-experience/public-experience.tsx",
  "utf8",
);

const validPayload = {
  projectId: "project-a",
  sessionId: "session-public-a",
  idempotencyKey: "idempotency-0001",
  serviceId: "service-a",
  startsAt: "2027-09-06T09:00:00",
  visitorData: { name: "Visitante QA" },
  honeypot: "",
};

function makeProject(input: {
  confirmationMode?: ConfirmationMode;
  resources?: NonNullable<NonNullable<Project["commercialConfig"]>["resources"]>;
  exceptions?: NonNullable<NonNullable<Project["commercialConfig"]>["availabilityExceptions"]>;
  serviceProjectId?: string;
  rules?: NonNullable<NonNullable<Project["commercialConfig"]>["availabilityRules"]>;
} = {}): Project {
  return {
    id: "project-a",
    workspaceId: "workspace-a",
    name: "Negócio QA",
    slug: "negocio-qa",
    description: "",
    subtitle: "",
    status: "published",
    primaryGoal: "Agendar",
    primaryDestination: "native",
    visualDirection: "balanced",
    steps: [],
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    designSystem: {} as Project["designSystem"],
    commercialConfig: {
      schedulableServices: [{
        id: "service-a",
        projectId: input.serviceProjectId || "project-a",
        name: "Consulta",
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        capacity: 1,
        confirmationMode: input.confirmationMode || "manual_approval",
        isActive: true,
      }],
      resources: input.resources || [{
        id: "resource-a",
        projectId: "project-a",
        name: "Sala A",
        kind: "room",
        isActive: true,
      }],
      availabilityRules: input.rules || [{
        id: "rule-a",
        projectId: "project-a",
        weekday: 1,
        startTime: "09:00",
        endTime: "12:00",
        timezone: "America/Sao_Paulo",
      }],
      availabilityExceptions: input.exceptions || [],
    },
  } as unknown as Project;
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-existing",
    projectId: "project-a",
    sessionId: "existing-session",
    serviceId: "service-a",
    startsAt: "2027-09-06T09:00:00",
    endsAt: "2027-09-06T09:30:00",
    status: "confirmed",
    confirmationMode: "instant",
    visitorData: {},
    ...overrides,
  };
}

function expectBoundaryCode(run: () => unknown, code: string) {
  try {
    run();
    throw new Error("expected_boundary_error");
  } catch (error) {
    expect(error).toBeInstanceOf(BookingBoundaryError);
    expect((error as BookingBoundaryError).code).toBe(code);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("P0-05 public scheduling trust boundary", () => {
  it("1. keeps a manual service pending and rejects client confirmation mode", () => {
    expect(bookingRequestSchema.safeParse({ ...validPayload, confirmationMode: "instant" }).success).toBe(false);
    expect(resolveBookingIntent({ project: makeProject(), serviceId: "service-a", startsAt: validPayload.startsAt }).status).toBe("pending");
  });

  it("2. confirms a valid instant service from server configuration", () => {
    const decision = resolveBookingIntent({ project: makeProject({ confirmationMode: "instant" }), serviceId: "service-a", startsAt: validPayload.startsAt });
    expect(decision).toMatchObject({ status: "confirmed", confirmationMode: "instant" });
  });

  it("3. rejects a resource that is not bound to a service when bindings exist", () => {
    expect(migration).toContain("from public.service_resources binding");
    expect(migration).toContain("binding.service_id = target_service");
    expect(migration).toContain("binding.resource_id = target_resource");
    expect(migration).toContain("resource_not_bound_to_service");
  });

  it("4. rejects a resource from another tenant", () => {
    const project = makeProject({ resources: [{ id: "resource-b", projectId: "project-b", name: "Sala B", kind: "room", isActive: true }] });
    expectBoundaryCode(() => resolveSchedulingSelection(project, "service-a", "resource-b"), "resource_not_found");
    expect(migration).toContain("resource.project_id = target_project");
  });

  it("5. rejects arbitrary duration and derives exactly the configured duration", () => {
    expect(bookingRequestSchema.safeParse({ ...validPayload, endsAt: "2027-09-06T17:00:00" }).success).toBe(false);
    const decision = resolveBookingIntent({ project: makeProject(), serviceId: "service-a", startsAt: validPayload.startsAt });
    expect(new Date(decision.endsAt).getTime() - new Date(decision.startsAt).getTime()).toBe(30 * 60_000);
    expect(migration).toContain("make_interval(mins => service_row.duration_minutes)");
  });

  it("6. rejects a time outside availability", () => {
    expectBoundaryCode(
      () => resolveBookingIntent({ project: makeProject(), serviceId: "service-a", startsAt: "2027-09-06T08:30:00" }),
      "slot_unavailable",
    );
  });

  it("7. rejects a blocked slot", () => {
    const project = makeProject({ exceptions: [{ id: "blocked", projectId: "project-a", startsAt: "2027-09-06T08:55:00", endsAt: "2027-09-06T09:35:00", isAvailable: false }] });
    expectBoundaryCode(
      () => resolveBookingIntent({ project, serviceId: "service-a", startsAt: validPayload.startsAt }),
      "slot_unavailable",
    );
    expect(migration).toContain("raise exception 'slot_blocked'");
  });

  it("8. rejects an existing booking conflict", () => {
    expectBoundaryCode(
      () => resolveBookingIntent({ project: makeProject(), serviceId: "service-a", startsAt: validPayload.startsAt, bookings: [booking()] }),
      "slot_unavailable",
    );
    expect(migration).toContain("raise exception 'booking_conflict'");
  });

  it("9. rejects client-controlled internal status", () => {
    expect(bookingRequestSchema.safeParse({ ...validPayload, status: "confirmed" }).success).toBe(false);
    expect(migration).toContain("effective_status := case");
  });

  it("10. accepts a legitimate booking and canonicalizes the configured timezone", () => {
    const parsed = bookingRequestSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    const decision = resolveBookingIntent({ project: makeProject(), serviceId: "service-a", startsAt: validPayload.startsAt });
    expect(decision).toMatchObject({
      startsAt: "2027-09-06T12:00:00.000Z",
      endsAt: "2027-09-06T12:30:00.000Z",
    });
  });

  it("11. blocks the native endpoint when the feature flag is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_SCHEDULING", "false");
    vi.resetModules();
    const { POST } = await import("@/app/api/public/bookings/route");
    const response = await POST(new Request("http://localhost/api/public/bookings", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "feature_disabled" } });
  });

  it("12. preserves project and workspace isolation", () => {
    expectBoundaryCode(
      () => resolveSchedulingSelection(makeProject({ serviceProjectId: "project-b" }), "service-a"),
      "service_not_found",
    );
    expect(migration).toContain("service.project_id = target_project");
    expect(migration).toContain("bookings_service_project_fkey");
    expect(migration).toContain("bookings_resource_project_fkey");
  });

  it("13. does not let known service or resource ids bypass the published project", () => {
    expect(migration).toContain("public.is_project_public(target_project)");
    expect(migration).toContain("service.id = target_service");
    expect(migration).toContain("resource.id = target_resource");
    expect(bookingRoute).toContain("getPublicProjectById");
  });

  it("14. serializes concurrent requests before the final overlap check", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("':booking:' || request_idempotency_key");
    expect(migration).toContain("':service:' || target_service::text");
    expect(migration).toContain("':resource:' || target_resource::text");
    expect(migration.indexOf("pg_advisory_xact_lock")).toBeLessThan(migration.indexOf("raise exception 'booking_conflict'"));
  });

  it("keeps every server-controlled field out of the browser payload", () => {
    for (const internalField of ["confirmationMode", "status", "endsAt", "projectWorkspaceId", "price"]) {
      expect(bookingRequestSchema.safeParse({ ...validPayload, [internalField]: "forged" }).success).toBe(false);
    }
    const remotePayload = publicExperience.slice(publicExperience.indexOf('fetch("/api/public/bookings"'), publicExperience.indexOf("addLead(", publicExperience.indexOf('fetch("/api/public/bookings"')));
    expect(remotePayload).not.toContain("...booking");
    expect(remotePayload).not.toContain("confirmationMode:");
    expect(remotePayload).not.toContain("endsAt:");
  });
});
