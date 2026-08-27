import { describe, expect, it } from "vitest";
import { normalizeDatabaseTimestamp } from "@/server/commercial-context/project-commercial-context-repository";

describe("commercial context database timestamps", () => {
  it("normaliza timestamps Postgres com offset para o ISO aceito pelo contrato", () => {
    expect(normalizeDatabaseTimestamp("2026-08-27 12:34:56.789+00:00"))
      .toBe("2026-08-27T12:34:56.789Z");
    expect(normalizeDatabaseTimestamp("2026-08-27T09:34:56.789-03:00"))
      .toBe("2026-08-27T12:34:56.789Z");
  });

  it("preserva nulos e deixa o schema rejeitar valores realmente inválidos", () => {
    expect(normalizeDatabaseTimestamp(null)).toBeNull();
    expect(normalizeDatabaseTimestamp("não-é-data")).toBe("não-é-data");
  });
});
