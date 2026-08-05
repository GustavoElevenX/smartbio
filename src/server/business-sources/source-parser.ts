import "server-only";
import { parseCSV, type CSVPreview } from "@/server/business-sources/csv-parser";
import { prepareImageSource } from "@/server/business-sources/image-source";
import { parsePDF } from "@/server/business-sources/pdf-parser";

export interface ParsedSource { text?: string; fileData?: string; mimeType?: string; metadata?: Record<string, unknown>; }
export async function parseSource(buffer: Buffer, sourceType: "text" | "csv" | "pdf" | "image", mimeType: string): Promise<ParsedSource> { if (sourceType === "text") return { text: buffer.toString("utf8").replaceAll("\0", "").slice(0, 120_000) }; if (sourceType === "csv") { const parsed = parseCSV(buffer); return { text: parsed.text, metadata: { csvPreview: parsed.preview satisfies CSVPreview } }; } if (sourceType === "image") return prepareImageSource(buffer, mimeType); const parsed = await parsePDF(buffer); return { text: parsed.text, fileData: parsed.visualData, mimeType: parsed.visualMimeType, metadata: { pageCount: parsed.pageCount, visualFallback: Boolean(parsed.visualData) } }; }
