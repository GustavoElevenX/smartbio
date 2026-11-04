import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { deriveDesignKit, planVisualVariants, readableInk } from "@/features/visual-engine/visual-planner";
import { assessVisual, renderVisualPng, visualSvg } from "@/server/visual-engine/render-art";

const kit = deriveDesignKit({ name: "Casa & Cia", palette: ["#07172F", "#E7E7E7", "#00D7E7"] });
describe("Motor Visual SOBE", () => {
  it("cria três alternativas com contexto da empresa e reutiliza referência aprovada", () => {
    const reference = planVisualVariants({ target: "hero", headline: "Anterior" }, kit, { name: "Casa & Cia", description: "Móveis sob medida" })[1];
    const variants = planVisualVariants({ target: "hero" }, { ...kit, referenceArtworkId: crypto.randomUUID(), version: 2 }, { name: "Casa & Cia", description: "Móveis sob medida" }, reference);
    expect(variants).toHaveLength(3);
    expect(variants[0].layout).toBe(reference.layout);
    expect(new Set(variants.map(item => item.layout)).size).toBe(3);
    expect(variants[0].kitVersion).toBe(2);
    expect(variants.every(item => item.imagePrompt.includes("No text"))).toBe(true);
    expect(variants.every(item => item.headline === "Casa & Cia")).toBe(true);
  });
  it("escapa texto do usuário e entrega PNG nos tamanhos prometidos", async () => {
    const spec = planVisualVariants({ target: "og", headline: "Oferta <especial> & única", cta: "Ver agora" }, kit, { name: "Casa & Cia", description: "Móveis sob medida" })[0];
    const svg = visualSvg(spec, kit, false);
    expect(svg).toContain("&lt;especial&gt; &amp;");
    expect(svg).toContain("única");
    expect(svg).not.toContain("<especial>");
    const png = await renderVisualPng(spec, kit);
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect([metadata.width, metadata.height]).toEqual([1200, 630]);
  });
  it("usa uma foto real sem cobri-la com o fundo SVG", async () => {
    const spec = planVisualVariants({ target: "hero" }, kit, { name: "Casa & Cia", description: "Móveis sob medida" })[0];
    const source = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#ed1234" } }).png().toBuffer();
    const png = await renderVisualPng(spec, kit, source);
    const pixel = await sharp(png).extract({ left: 1400, top: 450, width: 1, height: 1 }).raw().toBuffer();
    expect(pixel[0]).toBeGreaterThan(100);
  });
  it("escolhe contraste de texto a partir do fundo", () => {
    expect(readableInk("#FFFFFF")).toBe("#07172F");
    expect(readableInk("#07172F")).toBe("#FFFFFF");
  });
  it("valida três direções distintas para suco de laranja de 1 litro", async () => {
    const mix = deriveDesignKit({ name: "Casa de Sucos Mix", palette: ["#173F27", "#F6E8C8", "#F3921C"] });
    const specs = planVisualVariants({ target: "card", subject: "Suco de laranja em embalagem de 1 litro", headline: "Suco de laranja", subheading: "Embalagem de 1 litro" }, mix, { name: "Casa de Sucos Mix", description: "Sucos" });
    expect(new Set(specs.map(s => s.layout)).size).toBe(3);
    expect(specs.every(s => s.direction?.protagonist.includes("1 litro"))).toBe(true);
    const sources = ["mix-orange-1l-source.png", "mix-orange-1l-editorial.png", "mix-orange-1l-cutout.png"];
    for (let i=0;i<3;i++) {
      const source = await readFile(`artifacts/visual-engine/${sources[i]}`);
      expect(assessVisual(specs[i], mix, true, false)).toEqual([]);
      const png = await renderVisualPng(specs[i], mix, source);
      const meta = await sharp(png).metadata();
      expect([meta.width,meta.height]).toEqual([1080,1350]);
      if (process.env.RENDER_MIX_SAMPLE === "1") await writeFile(`artifacts/visual-engine/mix-alternative-${i+1}.png`, png);
    }
  });
});
