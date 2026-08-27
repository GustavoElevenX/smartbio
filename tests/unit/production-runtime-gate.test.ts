import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("P0-04 runtime production gate", () => {
  it("blocks demo fallback and memory rate limiting in production", () => {
    const publicLoader = read("src/server/projects/load-public-project.ts");
    const rateLimit = read("src/server/rate-limit/rate-limit.ts");
    expect(publicLoader).toContain("if (isProduction()) throw new ProductionConfigurationError");
    expect(rateLimit).toContain("if (process.env.NODE_ENV === \"production\")");
    expect(rateLimit).toContain("Rate limiting distribuído não configurado para produção.");
    expect(rateLimit).toContain("process.env.NODE_ENV === \"production\" || options.failClosed !== false");
  });

  it("wires Vercel deploy to the production gate and exposes non-secret readiness", () => {
    const vercel = JSON.parse(read("vercel.json"));
    const readiness = read("src/app/api/health/readiness/route.ts");
    expect(vercel.buildCommand).toBe("npm run production:check");
    expect(readiness).toContain('from("projects")');
    expect(readiness).toContain("checks: { application: true, configuration, supabase, rateLimit }");
    expect(readiness).not.toContain("SUPABASE_SERVICE_ROLE_KEY: process.env");
    expect(read("src/lib/env/client.ts")).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
