function cleanItem(value: string) {
  return value
    .replace(/^[-•*\d.)\s]+/, "")
    .replace(/[.;:,\s]+$/g, "")
    .trim();
}

function plausibleOffer(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  return value.length >= 3 && value.length <= 120 && words.length <= 12;
}

export function extractExplicitOfferNames(value: string) {
  const marker = /(?:serviços?|ofertas?|opções?|soluções?)\s*(?:oferecid[oa]s?|disponíveis|incluem|são)?\s*:\s*/i.exec(value);
  if (!marker) return [];
  const afterMarker = value.slice(marker.index + marker[0].length);
  const scoped = afterMarker
    .split(/\n\s*\n|\b(?:objetivo|jornada|visitante|próximo passo|atendimento final)\s*:/i)[0]
    .trim();
  const separator = scoped.includes(";")
    ? /\s*;\s*/
    : /\r?\n\s*(?:[-•*]\s*)?/;
  const offers = scoped.split(separator).map(cleanItem).filter(plausibleOffer);
  return offers.length >= 2 ? [...new Set(offers)].slice(0, 20) : [];
}

export function offerNamesFromSetup(description: string, answer: unknown) {
  const explicit = extractExplicitOfferNames(description);
  const mergePreservingExplicit = (values: string[]) => {
    const byName = new Map<string, string>();
    for (const value of [...explicit, ...values]) {
      const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (!byName.has(key)) byName.set(key, value);
    }
    return [...byName.values()].slice(0, 20);
  };
  if (Array.isArray(answer)) {
    const values = answer.map((item) => cleanItem(String(item))).filter(plausibleOffer);
    if (values.length) return mergePreservingExplicit(values);
  }
  if (typeof answer === "string" && answer.trim()) {
    const values = answer
      .split(/\r?\n|\s*;\s*/)
      .map(cleanItem)
      .filter(plausibleOffer);
    if (values.length) return mergePreservingExplicit(values);
  }
  return explicit;
}

export function contextSignature(value: string) {
  let hash = 2166136261;
  for (const character of value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `ctx-${(hash >>> 0).toString(36)}`;
}
