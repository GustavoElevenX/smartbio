import sharp from "sharp";
import { visualSizes, type DesignKit, type VisualSpec } from "@/features/visual-engine/schema";
import { contrastRatio, readableInk } from "@/features/visual-engine/visual-planner";

const xml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
const r = Math.round;
const mode = (name: string) => ({ split: "editorial", photo: "full_bleed", offer: "promotional", product: "product_hero", minimal: "minimal_premium" } as Record<string, string>)[name] || name;
function textBlock(value: string, x: number, y: number, width: number, height: number, initial: number, ink: string, weight: number, font: string) {
  if (!value) return { svg: "", bottom: y };
  let size = initial, rows: string[] = [];
  do {
    rows = []; let line = "";
    const cap = Math.max(8, Math.floor(width / (size * .55)));
    for (const word of value.trim().split(/\s+/)) { if (line && `${line} ${word}`.length > cap) { rows.push(line); line = word; } else line = line ? `${line} ${word}` : word; }
    if (line) rows.push(line);
    if (rows.length * size * 1.18 <= height) break;
    size -= 2;
  } while (size > 26);
  return { svg: rows.map((line, i) => `<text x="${r(x)}" y="${r(y+i*size*1.18)}" fill="${ink}" font-family="${font}" font-size="${r(size)}" font-weight="${weight}">${xml(line)}</text>`).join(""), bottom: y + rows.length * size * 1.18 };
}
export function assessVisual(spec: VisualSpec, kit: DesignKit, hasPhoto: boolean, hasLogo: boolean) {
  const issues: string[] = [], layout = mode(spec.layout);
  if (!spec.subject && hasPhoto) issues.push("Confirme que a fotografia mostra o produto anunciado.");
  if (spec.subject && ["full_bleed", "lifestyle", "product_hero", "editorial"].includes(layout) && !hasPhoto) issues.push("Esta composição precisa de fotografia para representar o produto.");
  if (contrastRatio(kit.primary, readableInk(kit.primary)) < 4.5) issues.push("Contraste insuficiente na cor principal.");
  if (spec.headline.length > 85) issues.push("Título longo; reduza para manter a hierarquia.");
  if (spec.subheading.length > 175) issues.push("Texto de apoio denso para a peça.");
  if (hasLogo && kit.name.length > 80) issues.push("Confira a marca na visualização final.");
  return issues;
}
export function visualSvg(spec: VisualSpec, kit: DesignKit, hasPhoto: boolean, hasLogo = false) {
  const { width: w, height: h } = visualSizes[spec.target], m = mode(spec.layout), scale = w/1080, pad = r(w*.07);
  const direction = spec.direction;
  const imageZone = direction?.imageZone || (["editorial", "promotional", "minimal_premium"].includes(m) ? "right" : "full");
  const side = ["right", "left"].includes(imageZone) && hasPhoto;
  const dark = imageZone === "full" && hasPhoto && direction?.treatment === "dark_overlay";
  const bg = m === "product_hero" ? kit.primary : m === "promotional" ? kit.secondary : kit.surface;
  const ink = dark ? "#FFFFFF" : contrastRatio(bg,kit.primary)>=4.5 ? kit.primary : readableInk(bg), font = kit.font === "serif" ? "Georgia,serif" : "Arial,sans-serif";
  const textRight = (imageZone === "left" && hasPhoto) || (imageZone === "full" && direction?.textZone === "right");
  const x = textRight ? w*.54 : pad;
  const width = side || textRight ? w*.39 : m === "full_bleed" && hasPhoto ? w*.53 : w-pad*2;
  let field = hasPhoto ? "" : `<rect width="${w}" height="${h}" fill="${bg}"/>`;
  if (dark) {
    const zone = direction?.textZone || "top";
    const gradient = zone === "bottom"
      ? `<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#07111B" stop-opacity="0"/><stop offset="1" stop-color="#07111B" stop-opacity=".78"/></linearGradient>`
      : zone === "right"
        ? `<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset=".28" stop-color="#07111B" stop-opacity="0"/><stop offset="1" stop-color="#07111B" stop-opacity=".78"/></linearGradient>`
        : zone === "left"
          ? `<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#07111B" stop-opacity=".78"/><stop offset=".72" stop-color="#07111B" stop-opacity="0"/></linearGradient>`
          : `<linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#07111B" stop-opacity=".72"/><stop offset=".5" stop-color="#07111B" stop-opacity=".46"/><stop offset=".8" stop-color="#07111B" stop-opacity="0"/></linearGradient>`;
    field += `<defs>${gradient}</defs><rect width="${w}" height="${h}" fill="url(#shade)"/>`;
  }
  if (direction?.treatment === "light_overlay" && imageZone === "full" && hasPhoto) field += `<rect width="${w}" height="${h}" fill="${kit.surface}" opacity=".70"/>`;
  if (direction?.motif === "rule" || (!direction && m === "editorial")) field += `<rect x="${x}" y="${r(h*.12)}" width="${r(w*.08)}" height="${r(7*scale)}" fill="${kit.accent}"/>`;
  if (direction?.motif === "disc" && !hasPhoto) field += `<circle cx="${r(w*.54)}" cy="${r(h*.52)}" r="${r(w*.33)}" fill="${kit.accent}" opacity=".18"/>`;
  if (direction?.motif === "frame") field += `<path d="M${pad} ${r(h*.1)}H${w-pad} M${pad} ${r(h*.91)}H${w-pad}" stroke="${kit.accent}" stroke-width="${r(3*scale)}"/>`;
  const top = m === "lifestyle" && hasPhoto ? h*.68 : m === "product_hero" ? h*.16 : m === "editorial" ? h*.22 : m === "minimal_premium" ? h*.34 : m === "promotional" ? h*.30 : h*.18;
  const zoneTop = direction?.textZone === "bottom" ? h*.68 : direction?.textZone === "center" ? h*.44 : top;
  const sizeFactor = direction?.typeScale === "restrained" ? .77 : direction?.typeScale === "expressive" ? 1.08 : 1;
  const title = textBlock(spec.headline, x, zoneTop, width, h*.27, r((h>w?85:70)*scale*sizeFactor), ink, 700, font);
  const subY = m === "product_hero" ? Math.max(h*.88,title.bottom+12) : m === "editorial" && direction?.textZone !== "bottom" ? Math.max(h*.75,title.bottom+12) : title.bottom+12*scale;
  const sub = textBlock(spec.subheading, x, subY, width, h*.15, r(33*scale), ink, 400, font);
  const priceY = Math.max(sub.bottom+24*scale,h*.73);
  const price = textBlock(spec.price,x,priceY,width,h*.09,r(53*scale),ink,700,font);
  const ctaY = spec.price ? price.bottom+12*scale : Math.max(sub.bottom+35*scale,h*.82);
  const cta = spec.cta && ctaY<h*.91 ? `<text x="${x}" y="${r(ctaY)}" fill="${ink}" font-family="${font}" font-size="${r(28*scale)}" font-weight="700">${xml(spec.cta)} <tspan fill="${kit.accent}">→</tspan></text>` : "";
  const brand = hasLogo ? "" : `<text x="${pad}" y="${r(h*.065)}" fill="${ink}" font-family="${font}" font-size="${r(32*scale)}" font-weight="700">${xml(kit.name)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${field}${brand}${title.svg}${sub.svg}${price.svg}${cta}</svg>`;
}
export async function renderVisualPng(spec: VisualSpec, kit: DesignKit, photo?: Buffer, logo?: Buffer) {
  const { width: w, height: h } = visualSizes[spec.target], m = mode(spec.layout);
  const activePhoto = Boolean(photo && spec.direction?.imageZone !== "none");
  const bg = m === "product_hero" ? kit.primary : m === "promotional" ? kit.secondary : kit.surface;
  const layers: Array<{ input: Buffer; left: number; top: number }> = [];
  if (photo && activePhoto) {
    const imageZone = spec.direction?.imageZone || (["editorial", "promotional", "minimal_premium"].includes(m) ? "right" : "full");
    const sideWidth = r(w*(spec.direction?.imageScale === "detail" ? .37 : spec.direction?.imageScale === "dominant" ? .51 : .47));
    const zone = imageZone === "right" ? {left:w-sideWidth,top:0,width:sideWidth,height:h} : imageZone === "left" ? {left:0,top:0,width:sideWidth,height:h} : imageZone === "center" ? {left:r(w*.13),top:r(h*.27),width:r(w*.74),height:r(h*.59)} : {left:0,top:0,width:w,height:h};
    const image = await sharp(photo,{limitInputPixels:40_000_000}).rotate().resize(zone.width,zone.height,{fit:imageZone==="center"||spec.direction?.treatment==="cutout"?"contain":"cover",position:spec.direction?.imageFocalPoint||"centre",background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
    layers.push({input:image,left:zone.left,top:zone.top});
  }
  layers.push({input:Buffer.from(visualSvg(spec,kit,activePhoto,Boolean(logo))),left:0,top:0});
  if (logo) {
    const mark = await sharp(logo,{limitInputPixels:4_000_000}).rotate().resize(r(w*.24),r(h*.07),{fit:"inside"}).png().toBuffer();
    layers.push({input:mark,left:r(w*.07),top:r(h*.026)});
  }
  return sharp({create:{width:w,height:h,channels:4,background:bg}}).composite(layers).png().toBuffer();
}
