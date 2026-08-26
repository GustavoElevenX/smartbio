import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractWebsiteText } from "@/server/business-sources/website-content";

const MAX_BYTES = 2_000_000;
const relevantPath = /(servic|produto|cardap|menu|contato|local|unidade|horario|pol[ií]tica|faq|sobre|agenda|orcamento|delivery|catalog)/i;

export type DetectedWebsiteLink = {
  url: string;
  label: string;
  classification: "whatsapp" | "menu" | "location" | "quote" | "commercial_b2b" | "delivery" | "scheduling" | "site" | "catalog" | "other";
  external: boolean;
};

function isPrivateIPv4(ip: string) {
  const parts = ip.split(".").map(Number);
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || parts[0] >= 224;
}

export function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const value = ip.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd")
    || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")
    || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.")
    || value.startsWith("::ffff:192.168.") || value.startsWith("::ffff:169.254.");
}

export async function assertSafeWebsiteUrl(rawUrl: string, expectedOrigin?: string) {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Use uma URL HTTP ou HTTPS pública.");
  if (expectedOrigin && url.origin !== expectedOrigin) throw new Error("Redirecionamento para outro domínio foi bloqueado.");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname === "metadata.google.internal") throw new Error("Endereço privado bloqueado.");
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateAddress(item.address))) throw new Error("Endereço privado bloqueado.");
  return url;
}

async function safeFetch(url: URL, origin: string, redirects = 0): Promise<{ url: URL; html: string }> {
  if (redirects > 3) throw new Error("O site excedeu o limite de redirecionamentos.");
  await assertSafeWebsiteUrl(url.toString(), origin);
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "user-agent": "SobeSourceImporter/1.0", accept: "text/html,application/xhtml+xml" } });
  if (response.status >= 300 && response.status < 400) {
    const target = response.headers.get("location");
    if (!target) throw new Error("Redirecionamento inválido.");
    return safeFetch(new URL(target, url), origin, redirects + 1);
  }
  if (!response.ok) throw new Error(`O site respondeu com status ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) throw new Error("A URL não retornou uma página HTML.");
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("A página excede o limite de tamanho.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("A página não retornou conteúdo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error("A página excede o limite de tamanho.");
    }
    chunks.push(value);
  }
  return { url, html: new TextDecoder().decode(Buffer.concat(chunks.map((item) => Buffer.from(item)))) };
}

function cleanLabel(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function classifyWebsiteLink(url: URL, label = ""): DetectedWebsiteLink["classification"] {
  const value = `${label} ${url.hostname} ${url.pathname} ${url.search}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/wa\.me|whatsapp|api\.whatsapp/.test(value)) return "whatsapp";
  if (/cardap|menu/.test(value)) return "menu";
  if (/catalog|portfolio|produtos?/.test(value)) return "catalog";
  if (/unidade|localiz|endereco|como-chegar|maps?\./.test(value)) return "location";
  if (/orcamento|cotacao|proposta/.test(value)) return "quote";
  if (/revenda|revendedor|atacado|distribuidor|comercial|b2b/.test(value)) return "commercial_b2b";
  if (/delivery|entrega|ifood|rappi/.test(value)) return "delivery";
  if (/agenda|agendamento|booking|reserva|reserve|calend/.test(value)) return "scheduling";
  if (/instagram|facebook|linkedin|site|home/.test(value)) return "site";
  return "other";
}

export function extractWebsiteLinks(html: string, base: URL): DetectedWebsiteLink[] {
  const seen = new Set<string>();
  return [...html.matchAll(/<a\b([^>]*)href\s*=\s*["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi)]
    .flatMap((match) => {
      try {
        const url = new URL(match[2], base);
        if (!["http:", "https:"].includes(url.protocol)) return [];
        url.hash = "";
        const key = url.toString();
        if (seen.has(key)) return [];
        seen.add(key);
        const label = cleanLabel(match[4]) || url.hostname;
        return [{ url: key, label, classification: classifyWebsiteLink(url, label), external: url.origin !== base.origin } satisfies DetectedWebsiteLink];
      } catch {
        return [];
      }
    })
    .filter((link) => link.external || link.classification !== "other")
    .slice(0, 40);
}

function internalLinks(html: string, base: URL) {
  return extractWebsiteLinks(html, base).flatMap((link) => {
    try {
      const url = new URL(link.url);
      return !link.external && relevantPath.test(url.pathname) ? [url] : [];
    } catch {
      return [];
    }
  });
}

export async function importWebsite(rawUrl: string) {
  const start = await assertSafeWebsiteUrl(rawUrl);
  const origin = start.origin;
  const queue = [start];
  const visited = new Set<string>();
  const pages: Array<{ url: string; text: string }> = [];
  const detectedLinks: DetectedWebsiteLink[] = [];
  while (queue.length && pages.length < 5) {
    const next = queue.shift()!;
    const key = `${next.origin}${next.pathname}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const result = await safeFetch(next, origin);
    const pageLinks = extractWebsiteLinks(result.html, result.url);
    detectedLinks.push(...pageLinks);
    const linksText = pageLinks.length
      ? `\nlinks comerciais detectados:\n${pageLinks.map((link) => `- [${link.classification}] ${link.label}: ${link.url}`).join("\n")}`
      : "";
    const text = `${extractWebsiteText(result.html)}${linksText}`.slice(0, 50_000);
    pages.push({ url: result.url.toString(), text });
    for (const link of internalLinks(result.html, result.url)) {
      if (!visited.has(`${link.origin}${link.pathname}`) && queue.length < 12) queue.push(link);
    }
  }
  return {
    pages,
    detectedLinks: [...new Map(detectedLinks.map((link) => [link.url, link])).values()].slice(0, 60),
    text: pages.map((page) => `PÁGINA: ${page.url}\n${page.text}`).join("\n\n").slice(0, 120_000),
  };
}
