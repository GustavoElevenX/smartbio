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
    `Premium advertising background visual for ${input.businessName}. Medium: ${d?.medium || "photography"}. Style: ${d?.visualStyle || input.kit.photoStyle}.`,
    `Advertised subject: ${subject}. If it is a physical product, preserve the exact format, packaging, size and volume explicitly provided. If it is a service, depict an authentic relevant situation instead of inventing a package.`,
    `Creative concept: ${d?.creativeConcept || input.spec.layout}. Protagonist: ${d?.protagonist || subject}.`,
    `Composition: ${d?.composition || input.spec.layout}. Image treatment: ${d?.photography || "professional commercial visual"}. Focal point: ${d?.imageFocalPoint || "center"}. Keep the subject fully visible with clear space in the ${d?.textZone || "left"} for editable graphic text.`,
    d?.revisionNote ? `Requested correction: ${d.revisionNote}. Preserve the established brand identity and all confirmed facts.` : "",
    `Brand colors as subtle environmental accents: ${input.kit.primary}, ${input.kit.secondary}, ${input.kit.accent}.`,
    "Compose the visual background as a complete art-directed campaign scene, not a stock photo or generic template. Use a coherent visual metaphor only when it clarifies the actual offer. No fabricated attributes or claims.",
    "No newly invented text, headline, typography, numbers, signs, logo, package copy, watermarks or UI. If a real product photograph is supplied as reference, preserve its existing package markings rather than replacing them.",
  ].join(" ").slice(0, 2000);
}
const strategy = ["full_bleed", "editorial", "product_hero", "minimal_premium", "promotional", "lifestyle"] as const;
export function makeDirection(layout: VisualSpec["layout"], subject: string, kit: DesignKit): ArtDirection {
  const options: Record<string, Partial<ArtDirection>> = {
    full_bleed: { creativeConcept: "Assunto em atmosfera real", composition: "Imagem imersiva com texto em espaço negativo legível", imageZone: "full", textZone: "top", imageFocalPoint: "right", treatment: "dark_overlay", motif: "none", typeScale: "expressive", imageScale: "dominant", medium: "photography" },
    editorial: { creativeConcept: "Ensaio editorial", composition: "Tipografia expressiva e imagem integrada com respiro assimétrico", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural", motif: "rule", typeScale: "expressive", imageScale: "dominant", medium: "mixed" },
    product_hero: { creativeConcept: "Assunto protagonista", composition: "Elemento principal inteiro e central com tipografia em campo separado", imageZone: "center", textZone: "top", imageFocalPoint: "center", treatment: "cutout", motif: "disc", typeScale: "balanced", imageScale: "dominant", medium: "photography" },
    minimal_premium: { creativeConcept: "Silêncio visual e precisão", composition: "Poucos elementos, escala contida e respiro intencional", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural", motif: "rule", typeScale: "restrained", imageScale: "detail", medium: "graphic" },
    promotional: { creativeConcept: "Informação comercial em primeiro plano", composition: "Oferta confirmada em destaque sem selos decorativos", imageZone: "right", textZone: "left", imageFocalPoint: "center", treatment: "natural", motif: "frame", typeScale: "expressive", imageScale: "balanced", medium: "mixed" },
    lifestyle: { creativeConcept: "Assunto em uso ou contexto", composition: "Cena real ocupando o quadro com texto em área legível", imageZone: "full", textZone: "bottom", imageFocalPoint: "right", treatment: "dark_overlay", motif: "none", typeScale: "balanced", imageScale: "dominant", medium: "photography" },
  };
  const choice = options[layout] || options.editorial;
  return artDirectionSchema.parse({ commercialObjective: "Apresentar a oferta e orientar a próxima ação", protagonist: subject, visualStyle: kit.photoStyle,
    typography: kit.font === "serif" ? "Título editorial com apoio contido" : "Título expressivo com apoio discreto", elementDistribution: choice.composition,
    paletteApplication: `Cor principal ${kit.primary} no campo, ${kit.accent} como acento pontual`, photography: `Fotografia ${kit.photoStyle} fiel ao assunto ${subject}; iluminação coerente, sem texto`, brandPlacement: "Assinatura com tamanho legível e margem segura", restrictions: ["Não inventar preço, benefício ou característica", "Preservar os fatos e o formato anunciados", "Não cortar o assunto principal", "Manter textos editáveis"], ...choice });
}
export function planVisualVariants(raw: unknown, kit: DesignKit, business: { name: string; description: string; offering?: string; defaultCta?: string }, reference?: VisualSpec): VisualSpec[] {
  const brief = visualBriefSchema.parse(raw);
  const subject = brief.subject || business.offering || "";
  const candidates = brief.price ? ["promotional", "full_bleed", "editorial"] : !brief.imageAssetId && !subject ? ["minimal_premium", "editorial", "full_bleed"] : ["full_bleed", "editorial", "product_hero"];
  const layouts = candidates as VisualSpec["layout"][];
  if (reference?.target === brief.target) {
    if (strategy.includes(reference.layout as typeof strategy[number])) {
      const ordered = [reference.layout, ...layouts.filter(item => item !== reference.layout), ...strategy.filter(item => item !== reference.layout)];
      layouts.splice(0, 3, ...[...new Set(ordered)].slice(0, 3));
    }
  }
  return layouts.map((layout, variant) => {
    const matchingReferenceImage = variant === 0 && subject && reference?.subject.trim().toLowerCase() === subject.trim().toLowerCase() ? reference.imageAssetId : null;
    const base = visualSpecSchema.parse({ target: brief.target, layout, headline: brief.headline || (subject ? subject.slice(0, 120) : business.name), subheading: brief.subheading ?? "", cta: brief.cta ?? business.defaultCta ?? "", price: brief.price || "", subject, imageAssetId: brief.imageAssetId ?? matchingReferenceImage ?? null, imagePrompt: "", kitVersion: kit.version, variant, direction: makeDirection(layout, subject || business.name, kit), directionSource: "rules" });
    return { ...base, imagePrompt: buildVisualPrompt({ kit, spec: base, businessName: business.name, businessDescription: business.description, offering: subject }) };
  });
}
