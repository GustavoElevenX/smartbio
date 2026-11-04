import { describe, expect, it } from "vitest";
import { contentBriefSchema, contentPlanSchema } from "@/features/content-studio/schema";
import { composioUserId, parseCloudflareImage, starterPlan } from "@/server/content-studio/studio";
import { renderSlideScene } from "@/server/content-studio/render-scene";
import sharp from "sharp";

describe("SOBE Conteúdo", () => {
  it("valida brief, limites e edição estruturada", () => {
    expect(contentBriefSchema.safeParse({ objective: "venda", theme: "a" }).success).toBe(false);
    expect(contentBriefSchema.safeParse({ objective: "venda", theme: "Tema real", desiredSlides: 9 }).success).toBe(false);
    expect(contentBriefSchema.parse({ objective: "venda", theme: "Tema real" }).desiredSlides).toBe(5);
  });

  it.each([
    ["Casa de Sucos Mix", "Sucos naturais", "consumidor"],
    ["Brasil Moto Peças", "Peças e serviços para motos", "motociclista"],
    ["Querido Pudim", "Fornecimento de pudim para revenda", "revendedor"],
    ["Clínica Lumina", "Atendimento de saúde", "paciente"],
    ["Vértice", "Consultoria comercial", "empresa"],
  ])("cria fixture isolada de %s sem inventar condições comerciais", (name, fact, audience) => {
    const plan = starterPlan(contentBriefSchema.parse({ objective: "venda", theme: `Conheça ${fact}` }), {
      name, description: fact, slug: "teste", palette: ["#07172F", "#0054FC"],
      context: { summary: { whatItSells: fact }, offeringContexts: [], audienceContexts: [{ label: audience, status: "confirmed" }] },
    });
    expect(contentPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.slides).toHaveLength(5);
    expect(plan.slides.at(-1)?.role).toBe("cta");
    expect(plan.factualBasis[0].fact).toBe(fact);
    expect(JSON.stringify(plan)).not.toMatch(/R\$|garantido|desconto de \d/i);
    expect(new Set(plan.slides.map(x => x.id)).size).toBe(5);
  });

  it("rejeita imagem inválida ou excessiva da Cloudflare", () => {
    expect(() => parseCloudflareImage({ result: { image: "%%%" } })).toThrow();
    expect(() => parseCloudflareImage({ result: { image: "a".repeat(16_000_001) } })).toThrow();
    const bytes = Buffer.alloc(1200, 4);
    expect(parseCloudflareImage({ result: { image: bytes.toString("base64") } })).toEqual(bytes);
  });

  it("isola identificadores OAuth por workspace e projeto", () => {
    expect(composioUserId("workspace-a", "project-a")).not.toBe(composioUserId("workspace-b", "project-a"));
    expect(composioUserId("workspace-a", "project-a")).not.toBe(composioUserId("workspace-a", "project-b"));
  });

  it("renderiza JPEG final 1080x1350 mesmo com caracteres de SVG no texto", async () => {
    const plan = starterPlan(contentBriefSchema.parse({ objective: "venda", theme: "Suco <natural> & fresco" }), { name: "Casa de Sucos Mix", description: "Sucos naturais", slug: "sucos", palette: ["#07172F"], context: null });
    const output = await renderSlideScene(plan.slides[0]);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("jpeg");
    expect([metadata.width, metadata.height]).toEqual([1080, 1350]);
    expect(output.length).toBeGreaterThan(1000);
  }, 20_000);
});
