import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/lib/app-url";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("publicação na Vercel", () => {
  it("usa o domínio de produção fornecido pela Vercel", () => {
    expect(
      resolveAppUrl({ VERCEL_PROJECT_PRODUCTION_URL: "sobe.vercel.app" }),
    ).toBe("https://sobe.vercel.app");
  });

  it("mantém o agendamento compatível com o plano Hobby", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.framework).toBe("nextjs");
    expect(config.crons).toEqual([
      {
        path: "/api/internal/notifications/process",
        schedule: "0 12 * * *",
      },
    ]);
  });

  it("expõe GET para chamadas do agendador da Vercel", () => {
    const route = read("src/app/api/internal/notifications/process/route.ts");
    expect(route).toContain("export async function GET");
    expect(route).toContain("authorization");
  });

  it("gera um arquivo sem NODE_ENV e sem campos vazios", () => {
    const generator = read("scripts/generate-vercel-env.ts");
    expect(generator).toContain('resolve(process.cwd(), ".env.vercel")');
    expect(generator).not.toContain('set("NODE_ENV"');
    expect(generator).toContain("if (value?.trim()) output.set");
  });
});
