import { describe, expect, it } from "vitest";
import {
  apiPayloadError,
  readApiPayload,
} from "@/lib/http/api-client-response";

describe("API client response parsing", () => {
  it("reads successful JSON payloads", async () => {
    const response = Response.json({ ok: true, data: { id: "source-1" } });

    await expect(readApiPayload<{ id: string }>(response, "Falha.")).resolves.toEqual({
      ok: true,
      data: { id: "source-1" },
    });
  });

  it("preserves structured API error messages", async () => {
    const response = Response.json(
      { ok: false, error: { message: "Site inacessível." } },
      { status: 400 },
    );
    const payload = await readApiPayload(response, "Falha.");

    expect(apiPayloadError(payload, "Falha.")).toBe("Site inacessível.");
  });

  it("turns an HTML timeout response into a useful message", async () => {
    const response = new Response("<!DOCTYPE html><title>Gateway Timeout</title>", {
      status: 504,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

    await expect(readApiPayload(response, "Falha.")).rejects.toThrow(
      "A importação demorou mais que o esperado. Tente novamente em instantes.",
    );
  });

  it("never exposes invalid JSON parser details", async () => {
    const response = new Response("<!DOCTYPE html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });

    await expect(readApiPayload(response, "Não foi possível importar o site.")).rejects.toThrow(
      "Não foi possível importar o site.",
    );
  });
});
