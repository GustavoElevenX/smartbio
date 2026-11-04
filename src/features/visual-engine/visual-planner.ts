import { artDirectionSchema, designKitSchema, visualBriefSchema, visualSpecSchema, type ArtDirection, type DesignKit, type VisualSpec } from "./schema";

function pickColor(value: unknown, fallback: string) { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback; }
function luminance(hex: string) { const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; }
export function readableInk(background: string) { return luminance(background) > .18 ? "#07172F" : "#FFFFFF"; }
export function contrastRatio(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function deriveDesignKit(input: { name: string; palette: string[]; logoAssetId?: string | null; category?: string | null }): DesignKit {
  const primary = pickColor(input.palette[0], "#07172F");
  const secondary = pickColor(input.palette[1], "#0054FC");
  const accent = pickColor(input.palette[2], "#00D7E7");
  const surface = luminance(primary) < .18 ? "#F4F7FB" : "#FFFFFF";
  return designKitSchema.parse({ version: 1, name: input.name, primary, secondary, accent, surface, ink: readableInk(primary), font: "sans", photoStyle: /moda|beleza|arte/i.test(input.category || "") ? "editorial" : "natural", logoAssetId: input.logoAssetId || null, referenceArtworkId: null });
}
export function buildVisualPrompt(input: { kit: DesignKit; spec: VisualSpec; businessName: string; businessDescription: string; offering?: string }) {
  const subject = input.offering || input.businessDescription || input.businessName;
  const d = input.spec.direction;
  return [
    `Premium commercial ${input.kit.photoStyle} photography for ${input.businessName}.`,
    `Exact advertised product: ${subject}. Depict its actual commercial package, scale and volume if specified; never replace a one-liter carton with a glass, bottle or small carton.`,
    `Creative concept: ${d?.creativeConcept || input.spec.layout}. Protagonist: ${d?.protagonist || subject}.`,
    `Composition: ${d?.composition || input.spec.layout}. Photography: ${d?.photography || "realistic product photography"}. Focal point: ${d?.imageFocalPoint || "center"}. Keep the product fully visible with clear space in the ${d?.textZone || "left"} for editable graphic text.`,
    `Brand colors as subtle environmental accents: ${input.kit.primary}, ${input.kit.secondary}, ${input.kit.accent}.`,
    "Realistic materials and professional lighting. No fabricated ingredients, claims or packaging facts.",
    "No text, letters, typography, numbers, signs, logo, labels, watermarks or UI.",
  ].join(" ").slice(0, 2000);
}
const strategy = ["full_bleed", "editorial", "product_hero", "minimal_premium", "promotional", "lifestyle"] as const;
export function makeDirection(layout: VisualSpec["layout"], subject: string, kit: DesignKit): ArtDirection {
  const options: Record<string, Pick<ArtDirection, "creativeConcept" | "composition" | "imageZone" | "textZone" | "imageFocalPoint" | "treatment">> = {
    full_bleed: { creativeConcept: "Produto em atmosfera real, imagem imersiva", composition: "Fotografia de ponta a ponta; título em espaço negativo protegido por sombra localizada", imageZone: "full", textZone: "top", imageFocalPoint: "right", treatment: "dark_overlay" },
    editorial: { creativeConcept: "Ensaio editorial de produto", composition: "Tipografia grande à esquerda e fotografia recortada à direita com respiro assimétrico", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural" },
    product_hero: { creativeConcept: "Produto como objeto de desejo", composition: "Produto inteiro central em campo de cor; título no topo e assinatura no rodapé", imageZone: "center", textZone: "top", imageFocalPoint: "center", treatment: "cutout" },
    minimal_premium: { creativeConcept: "Silêncio visual e precisão", composition: "Poucos elementos, fotografia pequena à direita e tipografia ampla à esquerda", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural" },
    promotional: { creativeConcept: "Oferta com hierarquia refinada", composition: "Produto à direita e informação comercial confirmada à esquerda, sem selos decorativos", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural" },
    lifestyle: { creativeConcept: "Produto em contexto cotidiano", composition: "Cena real ocupando o quadro com texto em faixa de contraste discreta", imageZone: "full", textZone: "bottom", imageFocalPoint: "right", treatment: "dark_overlay" },
  };
  const choice = options[layout] || options.editorial;
  return artDirectionSchema.parse({ commercialObjective: "Apresentar o produto e orientar a próxima ação", protagonist: subject, visualStyle: kit.photoStyle,
    typography: kit.font === "serif" ? "Título editorial com apoio contido" : "Título expressivo com apoio discreto", elementDistribution: choice.composition,
    paletteApplication: `Cor principal ${kit.primary} no campo, ${kit.accent} como acento pontual`, photography: `Fotografia ${kit.photoStyle} fiel ao formato comercial de ${subject}; iluminação natural, sem texto`, brandPlacement: "Assinatura no rodapé com tamanho legível", restrictions: ["Não inventar preço ou benefício", "Não substituir o formato do produto", "Não cortar a embalagem", "Manter textos editáveis"], ...choice });
}
export function planVisualVariants(raw: unknown, kit: DesignKit, business: { name: string; description: string; offering?: string; defaultCta?: string }, reference?: VisualSpec): VisualSpec[] {
  const brief = visualBriefSchema.parse(raw);
  const subject = brief.subject || business.offering || "";
  const candidates = brief.price ? ["promotional", "product_hero", "full_bleed"] : /serviço|consultoria|atendimento/i.test(subject) ? ["lifestyle", "editorial", "minimal_premium"] : ["full_bleed", "editorial", "product_hero"];
  const layouts = candidates as VisualSpec["layout"][];
  if (reference?.target === brief.target) {
    if (strategy.includes(reference.layout as typeof strategy[number])) {
      const ordered = [reference.layout, ...layouts.filter(item => item !== reference.layout), ...strategy.filter(item => item !== reference.layout)];
      layouts.splice(0, 3, ...[...new Set(ordered)].slice(0, 3));
    }
  }
  return layouts.map((layout, variant) => {
    const base = visualSpecSchema.parse({ target: brief.target, layout, headline: brief.headline || (subject ? subject.slice(0, 120) : business.name), subheading: brief.subheading ?? "", cta: brief.cta ?? business.defaultCta ?? "", price: brief.price || "", subject, imageAssetId: brief.imageAssetId ?? (variant === 0 ? reference?.imageAssetId : null) ?? null, imagePrompt: "", kitVersion: kit.version, variant, direction: makeDirection(layout, subject || business.name, kit) });
    return { ...base, imagePrompt: buildVisualPrompt({ kit, spec: base, businessName: business.name, businessDescription: business.description, offering: business.offering }) };
  });
}
