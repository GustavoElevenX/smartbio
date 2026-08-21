import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrls: vi.fn(),
  insertSingle: vi.fn(),
  assertProjectAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        createSignedUrls: mocks.createSignedUrls,
      }),
    },
    from: () => ({
      insert: () => ({
        select: () => ({ single: mocks.insertSingle }),
      }),
    }),
  }),
}));
vi.mock("@/server/auth/project-access", () => ({
  assertProjectAccess: mocks.assertProjectAccess,
}));

import { uploadMedia } from "@/server/media/media-service";

const actor = {
  userId: "user-1",
  email: "owner@example.com",
  workspaceId: "82969dc6-6682-41d1-be12-f125c278a45c",
  role: "owner" as const,
  persistence: "database" as const,
  mode: "workspace" as const,
};
const projectId = "3c806d8e-e93b-44dd-98fe-83b8dc3dccf6";

async function logoFile() {
  const buffer = await sharp({
    create: { width: 32, height: 32, channels: 4, background: "#0054fc" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], "logo.png", { type: "image/png" });
}

describe("media storage retries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.remove.mockResolvedValue({ error: null });
    mocks.createSignedUrls.mockResolvedValue({
      data: [{ signedUrl: "https://signed.test/original" }, { signedUrl: "https://signed.test/thumb" }],
      error: null,
    });
    mocks.insertSingle.mockImplementation(async () => ({
      data: {
        id: "asset-1",
        workspace_id: actor.workspaceId,
        project_id: projectId,
        storage_path: `${actor.workspaceId}/${projectId}/asset-1/original-logo.png`,
        original_filename: "logo.png",
        mime_type: "image/png",
        file_size: 100,
        width: 32,
        height: 32,
        asset_type: "logo",
        status: "ready",
        metadata: {},
        tags: [],
        created_at: "2026-08-20T00:00:00.000Z",
      },
      error: null,
    }));
  });

  it("recovers when one generated version fails transiently", async () => {
    const attempts = new Map<string, number>();
    mocks.upload.mockImplementation(async (path: string) => {
      const count = (attempts.get(path) || 0) + 1;
      attempts.set(path, count);
      if (path.endsWith("optimized.webp") && count === 1) {
        return { data: null, error: { message: "fetch failed" } };
      }
      return { data: { path }, error: null };
    });

    await expect(
      uploadMedia(actor, projectId, await logoFile(), { assetType: "logo" }),
    ).resolves.toMatchObject({ id: "asset-1", assetType: "logo" });

    expect(mocks.upload).toHaveBeenCalledTimes(4);
    expect([...attempts.entries()].find(([path]) => path.endsWith("optimized.webp"))?.[1]).toBe(2);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("cleans every generated path after retries are exhausted", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: "storage offline" } });

    await expect(
      uploadMedia(actor, projectId, await logoFile(), { assetType: "logo" }),
    ).rejects.toThrow("Não foi possível armazenar as versões da imagem. Tente novamente.");

    expect(mocks.upload).toHaveBeenCalledTimes(9);
    expect(mocks.remove).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringMatching(/original-logo\.png$/),
        expect.stringMatching(/optimized\.webp$/),
        expect.stringMatching(/thumbnail\.webp$/),
      ]),
    );
  });
});
