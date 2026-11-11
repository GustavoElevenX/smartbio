import type { PublicActivation } from "./activation.types";
import type { ActivationDynamicSurface } from "./dynamic-home-contract";

function stringValue(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || undefined : undefined;
}

export interface CampaignPresentation {
  title: string;
  message?: string;
  blocks: Array<{ key: string; kind: "offer" | "conditions" | "action"; title?: string; text?: string; label?: string }>;
}

/** Projeta somente campos textuais conhecidos. A oferta vem do snapshot da ativação. */
export function campaignPresentation(surface: ActivationDynamicSurface, activation: PublicActivation): CampaignPresentation {
  const hero = surface.sections.find((item) => item.kind === "hero");
  const offer = activation.offer?.offerType === "no_discount" ? undefined : activation.offer;
  const blocks: CampaignPresentation["blocks"] = [];
  let hasOffer = false;
  for (const section of surface.sections) {
    if (section.kind === "hero") continue;
    if (section.kind === "offer") {
      if (!offer || hasOffer) continue;
      blocks.push({ key: section.key, kind: "offer", text: offer.description, label: offer.label });
      hasOffer = true;
    } else if (section.kind === "conditions") {
      const text = stringValue(section.content.text, 1000);
      if (text) blocks.push({ key: section.key, kind: "conditions", title: stringValue(section.content.title, 120) || "Condições", text });
    } else if (section.kind === "action") {
      blocks.push({ key: section.key, kind: "action", title: stringValue(section.content.title, 120),
        text: stringValue(section.content.text, 600), label: stringValue(section.content.ctaLabel, 80) });
    }
  }
  if (offer && !hasOffer) blocks.unshift({ key: "offer", kind: "offer", label: offer.label, text: offer.description });
  return {
    title: stringValue(hero?.content.title, 160) || surface.title,
    message: stringValue(hero?.content.text, 1000) || surface.message,
    blocks,
  };
}
