import { describe, expect, it } from "vitest";
import { extractWebsiteText } from "@/server/business-sources/website-content";

describe("website source content extraction", () => {
  it("keeps useful metadata and JSON-LD from JavaScript-rendered sites", () => {
    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <title>Casa de Sucos Mix</title>
          <meta name="description" content="Sucos naturais do Maranhão" />
          <meta property="og:description" content="Fruta na frente &amp; marca em cada detalhe" />
          <script type="application/ld+json">
            {"@type":"Organization","name":"Casa de Sucos Mix"}
          </script>
          <script type="module" src="/assets/index.js"></script>
        </head>
        <body><div id="root"></div></body>
      </html>`;

    const result = extractWebsiteText(html);

    expect(result).toContain("título: Casa de Sucos Mix");
    expect(result).toContain("description: Sucos naturais do Maranhão");
    expect(result).toContain("Fruta na frente & marca em cada detalhe");
    expect(result).toContain('"@type":"Organization"');
    expect(result).not.toContain("/assets/index.js");
  });
});
