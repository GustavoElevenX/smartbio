const ENTITY_REPLACEMENTS: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&#160;": " ",
};

function decodeHtml(value: string) {
  return value.replace(
    /&(?:amp|quot|#39|apos|lt|gt|nbsp|#160);/gi,
    (entity) => ENTITY_REPLACEMENTS[entity.toLowerCase()] || entity,
  );
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]).trim() : "";
}

function metadata(html: string) {
  const values: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (attribute(tag, "name") || attribute(tag, "property")).toLowerCase();
    if (!["description", "og:title", "og:description"].includes(key)) continue;
    const content = attribute(tag, "content");
    if (content) values.push(`${key}: ${content}`);
  }
  return values;
}

function structuredData(html: string) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => decodeHtml(match[1]).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((value) => `dados estruturados: ${value.slice(0, 20_000)}`);
}

function visibleText(html: string) {
  return decodeHtml(
    html
      .replace(/<(script|style|iframe|noscript|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractWebsiteText(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const parts = [
    title ? `título: ${decodeHtml(title).replace(/\s+/g, " ").trim()}` : "",
    ...metadata(html),
    ...structuredData(html),
    visibleText(html),
  ].filter(Boolean);

  return [...new Set(parts)].join("\n").trim();
}
