import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { analyzeBrandFile } from "@/features/brand-intelligence/brand-analyzer";
import { sanitizeSvg, sanitizedSvgDataUrl } from "@/features/brand-intelligence/svg-sanitizer";

describe("sanitização de logos SVG", () => {
  it("preserva formas, gradientes, cores e texto usados na análise", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="brand"><stop offset="0%" stop-color="#ff3300"/><stop offset="100%" stop-color="#0066ff"/></linearGradient></defs><rect width="100" height="100" fill="url(#brand)"/><path d="M0 0 L50 50" style="stroke:#11aa22;stroke-width:2"/><text x="5" y="20">Marca &amp; Cia</text></svg>';
    const safe = sanitizeSvg(source);
    expect(safe).toContain('viewBox="0 0 100 100"');
    expect(safe).toContain('fill="url(#brand)"');
    expect(safe).toContain('stop-color="#ff3300"');
    expect(safe).toContain('stroke:#11aa22');
    expect(safe).toContain("Marca &amp; Cia");
  });

  it("remove script, conteúdo HTML e eventos; rejeita sintaxe sem aspas", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" onclick="alert(3)">x</div></foreignObject><rect width="20" height="20" onmouseover="alert(4)" fill="#123456"/></svg>';
    const safe = sanitizeSvg(source);
    expect(safe).not.toMatch(/script|foreignObject|onload|onclick|onmouseover|alert/i);
    expect(safe).toContain('fill="#123456"');
    expect(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" onload=alert(1) />')).toThrow();
  });

  it("bloqueia URLs remotas, esquemas ativos e CSS externo sem perder referências locais", () => {
    const source = '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="shape" d="M0 0 L5 5"/></defs><use href="#shape"/><image href="https://example.test/tracker.png"/><a href="javascript:alert(1)"><rect width="4" height="4"/></a><path d="M1 1" style="fill:url(https://example.test/x);stroke:#abcdef"/></svg>';
    const safe = sanitizeSvg(source);
    expect(safe).toContain('href="#shape"');
    expect(safe).toContain('stroke:#abcdef');
    expect(safe).not.toMatch(/example\.test|javascript:|<a\b|url\(https:/i);
  });

  it("preserva somente imagens raster incorporadas", () => {
    const safe = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo="/><image href="data:image/svg+xml;base64,PHN2Zz4="/></svg>');
    expect(safe).toContain("data:image/png;base64,iVBORw0KGgo=");
    expect(safe).not.toContain("data:image/svg+xml");
  });

  it("preserva cores de classes SVG e descarta regras CSS externas", () => {
    const safe = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><defs><style>.cor{fill:#cc4400;stroke:#113355}@import url(https://example.test/a.css);.outra{fill:url(https://example.test/x)}</style></defs><rect class="cor" width="20" height="20"/></svg>');
    expect(safe).toContain("fill:#cc4400");
    expect(safe).toContain("stroke:#113355");
    expect(safe).not.toMatch(/@import|example\.test|<style|class=/i);
  });

  it("continua permitindo rasterização e extração de cores", async () => {
    const safe = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect class="cor" width="20" height="20" style="fill:#d02030"/></svg>');
    const pixel = await sharp(Buffer.from(safe)).resize(1, 1).raw().toBuffer();
    expect([...pixel.subarray(0, 3)]).toEqual([208, 32, 48]);
  });

  it("usa somente SVG sanitizado na prévia em data URL", () => {
    const url = sanitizedSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect fill="#d02030" width="20" height="20"/></svg>');
    const decoded = decodeURIComponent(url.split(",", 2)[1]);
    expect(decoded).toContain('fill="#d02030"');
    expect(decoded).not.toMatch(/onload|alert/i);
  });

  it("analisa SVG no navegador sem ler a versão bruta no FileReader", async () => {
    class PreviewImage {
      naturalWidth = 20;
      naturalHeight = 20;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        expect(decodeURIComponent(value)).not.toContain("onload");
        this.onload?.();
      }
    }
    vi.stubGlobal("FileReader", class { constructor() { throw new Error("SVG bruto não deve ir ao FileReader"); } });
    vi.stubGlobal("Image", PreviewImage);
    vi.stubGlobal("document", { createElement: () => ({
      getContext: () => ({
        clearRect: () => undefined,
        drawImage: () => undefined,
        getImageData: () => ({ data: new Uint8ClampedArray([208, 32, 48, 255]) }),
      }),
    }) });
    try {
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="20" height="20" fill="#d02030"/></svg>'], "marca.svg", { type: "image/svg+xml" });
      const profile = await analyzeBrandFile(file);
      expect(profile.extractedColors[0]).toBe("#D81830");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejeita DTD, entidades e XML malformado", () => {
    expect(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg xmlns="http://www.w3.org/2000/svg">&x;</svg>')).toThrow();
    expect(() => sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg"><path></svg>')).toThrow();
  });
});
