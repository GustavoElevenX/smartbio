import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  loadProjectForActor: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
        })),
      })),
    })),
  }),
}));
vi.mock("@/server/projects/load-project-for-actor", () => ({
  loadProjectForActor: mocks.loadProjectForActor,
}));

import { loadProjectPreviewBySlug } from "@/server/projects/load-project-preview";

const actor = {
  userId: "user-1",
  email: "owner@example.com",
  workspaceId: "workspace-1",
  role: "owner" as const,
  persistence: "database" as const,
  mode: "workspace" as const,
};

describe("project preview loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "project-1" },
      error: null,
    });
    mocks.loadProjectForActor.mockResolvedValue({
      id: "project-1",
      slug: "casa-de-sucos-mix",
    });
  });

  it("loads a draft through the authenticated project loader", async () => {
    await expect(
      loadProjectPreviewBySlug(actor, "casa-de-sucos-mix"),
    ).resolves.toMatchObject({ id: "project-1" });

    expect(mocks.loadProjectForActor).toHaveBeenCalledWith(actor, "project-1");
  });

  it("does not expose a slug outside the active workspace", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(
      loadProjectPreviewBySlug(actor, "outro-workspace"),
    ).resolves.toBeNull();
    expect(mocks.loadProjectForActor).not.toHaveBeenCalled();
  });
});
