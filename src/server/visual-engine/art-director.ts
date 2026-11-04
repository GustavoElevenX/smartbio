import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { artDirectionSchema, visualBriefSchema, visualLayoutSchema, type DesignKit, type VisualSpec } from "@/features/visual-engine/schema";
import { buildVisualPrompt, makeDirection, planVisualVariants } from "@/features/visual-engine/visual-planner";

const directionsSchema = z.object({ proposals: z.array(z.object({ layout: visualLayoutSchema, direction: artDirectionSchema })).length(3) });
export async function directArt(raw: unknown, kit: DesignKit, business: { name: string; description: string; offering?: string; defaultCta?: string }, reference?: VisualSpec) {
  const brief = visualBriefSchema.parse(raw);
  const base = planVisualVariants(brief, kit, business, reference);
  if (!process.env.OPENAI_API_KEY) return base;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45000, maxRetries: 0 });
  const result = await client.responses.parse({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17", max_output_tokens: 4000,
    input: [{ role: "system", content: "Você é diretor de arte publicitário. Crie exatamente três propostas visuais substancialmente diferentes. Selecione três estratégias distintas entre full_bleed, editorial, product_hero, minimal_premium, promotional, lifestyle. O Design Kit restringe a linguagem cromática e tipográfica. Produto, embalagem, volume e alegações devem corresponder estritamente aos fatos. Não invente preços, benefícios ou características. Não inclua texto rasterizado na fotografia. Descreva posicionamento, contraste, áreas seguras e tratamento. Responda em português brasileiro no schema." },
      { role: "user", content: JSON.stringify({ brief, kit, business, reference: reference?.direction, fallback: base.map(x => x.direction) }) }],
    text: { format: zodTextFormat(directionsSchema, "art_directions") } });
  const proposals = result.output_parsed?.proposals;
  if (!proposals || new Set(proposals.map(x => x.layout)).size !== 3) return base;
  return proposals.map((proposal, variant) => {
    const layout = proposal.layout;
    const direction = { ...makeDirection(layout, base[variant].subject || business.name, kit), ...proposal.direction,
      protagonist: base[variant].subject || business.name,
      restrictions: [...new Set([...proposal.direction.restrictions, "Não inventar preço, benefício ou característica", "Não alterar volume ou formato comercial do produto", "Não cortar o produto"])].slice(0, 12) };
    const spec = { ...base[variant], layout, direction, variant };
    return { ...spec, imagePrompt: buildVisualPrompt({ kit, spec, businessName: business.name, businessDescription: business.description, offering: spec.subject }) };
  });
}
export async function verifyArtworkQuality(subject: string, kit: DesignKit, image: Buffer) {
  if (!process.env.OPENAI_API_KEY) return;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 });
  const verdictSchema = z.object({ productMatch: z.boolean(), legible: z.boolean(), contrast: z.boolean(), logoSize: z.boolean(), safeMargins: z.boolean(), hierarchy: z.boolean(), alignment: z.boolean(), density: z.boolean(), noBadCrop: z.boolean(), kitCoherence: z.boolean(), reason: z.string().max(300) });
  const result = await client.responses.parse({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17", max_output_tokens: 350,
    input: [{ role: "system", content: "Você faz controle de qualidade de uma peça publicitária final. Avalie fatos visíveis, não preferências subjetivas. Produto e volume devem corresponder à descrição; se não houver produto especificado, productMatch é true. Considere legibilidade, contraste, logo/assinatura com tamanho legível, margens seguras, hierarquia, alinhamento, densidade, cortes indesejados e coerência de cores. Não exija logo gráfico quando a marca aparece em texto. Seja rigoroso apenas com problemas materiais. Responda no schema." },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify({ advertisedProduct: subject, designKit: { name: kit.name, primary: kit.primary, secondary: kit.secondary, accent: kit.accent, surface: kit.surface } }) }, { type: "input_image", image_url: `data:image/png;base64,${image.toString("base64")}`, detail: "high" }] }],
    text: { format: zodTextFormat(verdictSchema, "artwork_quality") } });
  const verdict = result.output_parsed;
  if (!verdict) throw new Error("A IA não conseguiu verificar a arte final.");
  const failed = Object.entries(verdict).filter(([key, value]) => key !== "reason" && value === false).map(([key]) => key);
  if (failed.length) throw new Error(`Revise a arte antes de aprovar (${failed.join(", ")}): ${verdict.reason}`);
}
