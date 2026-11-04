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
export async function verifyPhotographicSubject(subject: string, image: Buffer) {
  if (!process.env.OPENAI_API_KEY || !subject) return;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 });
  const verdictSchema = z.object({ matches: z.boolean(), reason: z.string().max(180) });
  const result = await client.responses.parse({ model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini-2026-03-17", max_output_tokens: 180,
    input: [{ role: "system", content: "Verifique se a foto representa o produto anunciado, incluindo volume e formato de embalagem quando especificados. Seja estrito: copo, garrafa ou embalagem pequena não correspondem a caixa de suco de 1 litro. Não infira texto ilegível." },
      { role: "user", content: [{ type: "input_text", text: `Produto anunciado: ${subject}` }, { type: "input_image", image_url: `data:image/png;base64,${image.toString("base64")}`, detail: "low" }] }],
    text: { format: zodTextFormat(verdictSchema, "product_match") } });
  if (!result.output_parsed?.matches) throw new Error(`A fotografia não parece corresponder ao produto: ${result.output_parsed?.reason || "revise a embalagem e o volume."}`);
}
