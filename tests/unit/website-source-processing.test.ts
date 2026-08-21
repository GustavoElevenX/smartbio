import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSafeWebsiteUrl: vi.fn(),
  importWebsite: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  replaceFacts: vi.fn(),
  extractSourceFacts: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({}) }));
vi.mock("@/server/auth/project-access", () => ({ assertProjectAccess: vi.fn() }));
vi.mock("@/server/business-sources/source-extractor", () => ({
  extractSourceFacts: mocks.extractSourceFacts,
}));
vi.mock("@/server/business-sources/source-parser", () => ({ parseSource: vi.fn() }));
vi.mock("@/server/business-sources/source-repository", () => ({
  sourceRepository: {
    create: mocks.create,
    get: mocks.get,
    update: mocks.update,
    replaceFacts: mocks.replaceFacts,
  },
}));
vi.mock("@/server/business-sources/website-source", () => ({
  assertSafeWebsiteUrl: mocks.assertSafeWebsiteUrl,
  importWebsite: mocks.importWebsite,
}));
vi.mock("@/server/notifications/notification-service", () => ({
  notifyProjectEvent: vi.fn(),
}));
vi.mock("@/server/entitlements/require-entitlement", () => ({
  requireEntitlement: vi.fn(),
}));

import {
  createWebsiteSource,
  processWebsiteSource,
} from "@/server/business-sources/source-service";

const actor = {
  userId: "user-1",
  email: "owner@example.com",
  workspaceId: "workspace-1",
  role: "owner" as const,
  persistence: "database" as const,
  mode: "workspace" as const,
};

const source = {
  id: "source-1",
  workspaceId: actor.workspaceId,
  type: "website" as const,
  name: "casadesucosmix.netlify.app",
  sourceUrl: "https://casadesucosmix.netlify.app/",
  status: "pending" as const,
  extractedData: {},
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

describe("website source processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSafeWebsiteUrl.mockResolvedValue(new URL(source.sourceUrl));
    mocks.create.mockResolvedValue(source);
    mocks.get.mockResolvedValue(source);
    mocks.update.mockImplementation(async (_actor, _id, patch) => ({
      ...source,
      status: patch.status || source.status,
      processingError: patch.processing_error || undefined,
    }));
    mocks.replaceFacts.mockResolvedValue([]);
    mocks.extractSourceFacts.mockResolvedValue({ facts: [] });
    mocks.importWebsite.mockResolvedValue({
      pages: [{ url: source.sourceUrl, text: "Casa de Sucos Mix" }],
      text: `PÁGINA: ${source.sourceUrl}\nCasa de Sucos Mix`,
    });
  });

  it("registers a safe URL before starting background work", async () => {
    await expect(
      createWebsiteSource(actor, { url: source.sourceUrl }),
    ).resolves.toMatchObject({ id: source.id, status: "pending" });

    expect(mocks.assertSafeWebsiteUrl).toHaveBeenCalledWith(source.sourceUrl);
    expect(mocks.create).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        type: "website",
        name: "casadesucosmix.netlify.app",
        sourceUrl: source.sourceUrl,
      }),
    );
  });

  it("moves the source from processing to processed", async () => {
    await expect(processWebsiteSource(actor, source.id)).resolves.toMatchObject({
      source: { status: "processed" },
    });

    expect(mocks.importWebsite).toHaveBeenCalledWith(source.sourceUrl);
    expect(mocks.update).toHaveBeenCalledWith(
      actor,
      source.id,
      expect.objectContaining({ status: "processing" }),
    );
    expect(mocks.update).toHaveBeenLastCalledWith(
      actor,
      source.id,
      expect.objectContaining({
        status: "processed",
        extracted_text: expect.stringContaining("Casa de Sucos Mix"),
      }),
    );
  });

  it("persists a failure when collection cannot finish", async () => {
    mocks.importWebsite.mockRejectedValue(new Error("Site indisponível."));

    await expect(processWebsiteSource(actor, source.id)).rejects.toThrow(
      "Site indisponível.",
    );
    expect(mocks.update).toHaveBeenLastCalledWith(actor, source.id, {
      status: "failed",
      processing_error: "Site indisponível.",
    });
  });
});
