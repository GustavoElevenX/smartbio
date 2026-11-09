import { DOMImplementation, DOMParser, XMLSerializer, type Element, type Node } from "@xmldom/xmldom";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SVG_CHARS = 5 * 1024 * 1024;
const MAX_NODES = 10_000;
const MAX_DEPTH = 64;

const elements = new Set([
  "svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "pattern", "use", "image",
  "text", "tspan", "textPath", "symbol", "title", "desc",
]);
const attributes = new Set([
  "id", "viewBox", "preserveAspectRatio", "width", "height", "x", "y", "x1", "y1", "x2", "y2",
  "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset",
  "fill-rule", "clip-rule", "opacity", "fill-opacity", "stroke-opacity", "stop-color", "stop-opacity",
  "offset", "gradientUnits", "gradientTransform", "spreadMethod", "clip-path", "mask",
  "patternUnits", "patternContentUnits", "patternTransform", "font-family", "font-size", "font-weight",
  "text-anchor", "dominant-baseline", "letter-spacing", "paint-order", "vector-effect",
]);
const paints = new Set(["fill", "stroke", "stop-color"]);
const references = new Set(["clip-path", "mask"]);
const idPattern = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
const localReference = /^url\(#[A-Za-z_][A-Za-z0-9_.:-]{0,127}\)$/;
const rasterData = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;
const paintValue = /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\))$/i;
const drawingValue = /^[\w\s.,+\-()%#]*$/;

function safeValue(name: string, value: string, element: string): string | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  if (name !== "href" && name !== "xlink:href" && clean.length > 8_192) return undefined;
  if (name === "id") return idPattern.test(clean) ? clean : undefined;
  if (name === "href" || name === "xlink:href") {
    if (element === "image" && clean.length <= 2 * 1024 * 1024 && rasterData.test(clean)) return clean;
    return /^#[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(clean) ? clean : undefined;
  }
  if (references.has(name)) return localReference.test(clean) ? clean : undefined;
  if (paints.has(name)) return paintValue.test(clean) || localReference.test(clean) ? clean : undefined;
  if (!attributes.has(name) || /url\s*\(/i.test(clean)) return undefined;
  return drawingValue.test(clean) ? clean : undefined;
}

function safeStyle(value: string): string | undefined {
  if (value.length > 8_192) return undefined;
  const declarations: string[] = [];
  for (const part of value.split(";")) {
    const separator = part.indexOf(":");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim().toLowerCase();
    if (!attributes.has(name)) continue;
    const safe = safeValue(name, part.slice(separator + 1), "style");
    if (safe) declarations.push(`${name}:${safe}`);
  }
  return declarations.length ? declarations.join(";") : undefined;
}

function classStyles(document: ReturnType<DOMParser["parseFromString"]>) {
  const styles = new Map<string, string>();
  const blocks = document.getElementsByTagNameNS(SVG_NS, "style");
  for (let index = 0; index < blocks.length; index++) {
    const css = blocks.item(index)?.textContent || "";
    if (css.length > 50_000) continue;
    for (const rule of css.split("}")) {
      if (!rule.trim()) continue;
      const parts = rule.split("{");
      if (parts.length !== 2) continue;
      const selector = parts[0].trim();
      if (!/^\.[A-Za-z_][A-Za-z0-9_-]*(?:\s*,\s*\.[A-Za-z_][A-Za-z0-9_-]*)*$/.test(selector)) continue;
      const safe = safeStyle(parts[1]);
      if (!safe) continue;
      for (const name of selector.split(",")) {
        if (styles.size >= 200) break;
        styles.set(name.trim().slice(1), safe);
      }
    }
  }
  return styles;
}

/** Keep only passive SVG drawing data. No scripts, active elements or remote resource references survive. */
export function sanitizeSvg(svg: string): string {
  if (!svg || svg.length > MAX_SVG_CHARS || /<!\s*(?:DOCTYPE|ENTITY)/i.test(svg)) {
    throw new Error("SVG inválido ou acima do limite permitido.");
  }
  const parsed = new DOMParser({ onError: (_level, message) => { throw new Error(message); } })
    .parseFromString(svg, "image/svg+xml");
  const source = parsed.documentElement;
  if (!source || source.localName !== "svg" || source.namespaceURI !== SVG_NS) {
    throw new Error("O arquivo não contém uma imagem SVG válida.");
  }
  const styles = classStyles(parsed);
  const output = new DOMImplementation().createDocument(SVG_NS, "svg", null);
  let count = 0;
  function copy(from: Node, to: Node, depth: number) {
    if (++count > MAX_NODES || depth > MAX_DEPTH) throw new Error("SVG complexo demais.");
    if (from.nodeType === 3) {
      if (to.nodeName === "text" || to.nodeName === "tspan" || to.nodeName === "textPath" || to.nodeName === "title" || to.nodeName === "desc") {
        to.appendChild(output.createTextNode(from.nodeValue || ""));
      }
      return;
    }
    if (from.nodeType !== 1 || from.namespaceURI !== SVG_NS) return;
    const sourceElement = from as Element;
    const tag = sourceElement.localName || "";
    if (!elements.has(tag)) return;
    const target = depth === 0 ? output.documentElement! : output.createElementNS(SVG_NS, tag);
    if (depth !== 0) to.appendChild(target);
    const classNames = sourceElement.getAttribute("class")?.split(/\s+/) || [];
    const classStyle = classNames.map((name) => styles.get(name)).filter(Boolean).join(";");
    if (classStyle) target.setAttribute("style", classStyle);
    for (let index = 0; index < sourceElement.attributes.length; index++) {
      const attribute = sourceElement.attributes.item(index)!;
      if (attribute.name === "style") {
        const style = safeStyle(attribute.value);
        if (style) target.setAttribute("style", classStyle ? `${classStyle};${style}` : style);
        continue;
      }
      const name = attribute.localName === "href" ? "href" : attribute.name;
      if (attribute.namespaceURI && attribute.namespaceURI !== "http://www.w3.org/1999/xlink") continue;
      const value = safeValue(name, attribute.value, tag);
      if (value) target.setAttribute(name === "xlink:href" ? "href" : name, value);
    }
    for (let child = from.firstChild; child; child = child.nextSibling) copy(child, target, depth + 1);
  }
  copy(source, output.documentElement!, 0);
  return new XMLSerializer().serializeToString(output);
}

export function sanitizedSvgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sanitizeSvg(svg))}`;
}
