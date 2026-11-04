import sharp from "sharp";
import type { ContentSlide } from "@/features/content-studio/schema";

function escapeXml(value: string) { return value.replace(/[&<>"']/g, x => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[x]!); }
function wrapped(value: string, width: number) {
  const words = value.split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { if ((line + " " + word).length > width && line) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word; }
  if (line) lines.push(line); return lines;
}
export async function renderSlideScene(slide: ContentSlide, image?: Buffer, logo?: Buffer) {
  const split = slide.layoutId === "split";
  const photo = slide.layoutId === "photo" && Boolean(image);
  const statement = slide.layoutId === "statement";
  const closing = slide.layoutId === "closing";
  const titleY = photo ? 820 : image && !split && !statement && !closing ? 790 : closing ? 500 : statement ? 360 : 270;
  const x = statement ? 110 : 80;
  const titleLines = wrapped(slide.headline, split ? 13 : 22);
  const fontSize = split ? 58 : closing ? 76 : 68;
  const step = split ? 70 : 84;
  const title = titleLines.map((line, i) => `<text x="${x}" y="${titleY + i * step}" fill="${slide.textColor}" font-size="${fontSize}" font-weight="700" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("");
  const bodyY = titleY + titleLines.length * step + 26;
  const body = wrapped(slide.body, split ? 24 : 40).map((line, i) => `<text x="${x}" y="${bodyY + i * 44}" fill="${slide.textColor}" font-size="${split ? 28 : 32}" font-family="Arial, sans-serif">${escapeXml(line)}</text>`).join("");
  const accents = `${closing ? '<circle cx="920" cy="180" r="170" fill="#00D7E7"/>' : ""}${statement ? '<rect x="0" y="0" width="20" height="1350" fill="#00D7E7"/>' : ""}${split ? '<rect x="622" y="0" width="8" height="1350" fill="#00D7E7"/>' : ""}${photo ? `<rect x="0" y="710" width="1080" height="640" fill="${slide.backgroundColor}"/>` : ""}`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">${accents}<rect x="${x}" y="${titleY-100}" width="92" height="8" fill="#00D7E7"/>${title}${body}</svg>`);
  const layers: Array<{ input: Buffer; left: number; top: number }> = [];
  if (image) {
    const size = split ? { width: 450, height: 1350, left: 630, top: 0 } : statement ? { width: 260, height: 260, left: 740, top: 35 } : closing ? { width: 1080, height: 360, left: 0, top: 990 } : photo ? { width: 1080, height: 1350, left: 0, top: 0 } : { width: 1080, height: 690, left: 0, top: 0 };
    const pixels = await sharp(image, { limitInputPixels: 40_000_000 }).rotate().resize(size.width, size.height, { fit: "cover", position: slide.imagePosition }).jpeg().toBuffer();
    layers.push({ input: pixels, left: size.left, top: size.top });
  }
  layers.push({ input: svg, left: 0, top: 0 });
  if (logo) {
    const panel = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120"><rect width="220" height="120" rx="14" fill="#ffffff"/></svg>');
    layers.push({ input: panel, left: 70, top: 1200 });
    const mark = await sharp(logo, { limitInputPixels: 4_000_000 }).resize(180, 84, { fit: "contain" }).png().toBuffer();
    layers.push({ input: mark, left: 90, top: 1218 });
  }
  return sharp({ create: { width: 1080, height: 1350, channels: 3, background: slide.backgroundColor } }).composite(layers).flatten().jpeg({ quality: 87, mozjpeg: true }).toBuffer();
}
