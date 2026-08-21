import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/ai/sources/website/route.ts"),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "src/server/business-sources/source-service.ts"),
  "utf8",
);
const uploader = readFileSync(
  resolve(process.cwd(), "src/components/ai-setup/source-uploader.tsx"),
  "utf8",
);
const conversation = readFileSync(
  resolve(process.cwd(), "src/components/ai-setup/ai-conversation.tsx"),
  "utf8",
);

describe("asynchronous website import flow", () => {
  it("returns the source before running extraction in the background", () => {
    expect(route).toContain("after(async () =>");
    expect(route).toContain("await processWebsiteSource(actor, source.id)");
    expect(route).toContain("{ status: 202 }");
    expect(route).toContain("export const maxDuration = 120");
  });

  it("persists processing and failure states", () => {
    expect(service).toContain('status: "processing"');
    expect(service).toContain('status: "failed"');
    expect(service).toContain("processing_error:");
  });

  it("polls status and blocks analysis until sources finish", () => {
    expect(uploader).toContain("/api/ai/sources/${source.id}");
    expect(uploader).toContain("window.setInterval");
    expect(conversation).toContain("sourcesProcessing");
    expect(conversation).toContain("Importando materiais…");
  });
});
