import { describe, expect, it } from "vitest";
import { parsePDF } from "@/server/business-sources/pdf-parser";

function textPdf() {
  const stream = "BT /F1 12 Tf 40 750 Td (SOBE QA: delivery and pickup. Confirmed menu: Burger 24 BRL, fries 12 BRL. Contact the selected store to finish the order.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(document.length); document += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = document.length;
  document += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(document);
}

describe("PDF source parser runtime", () => {
  it("carrega o parser somente ao processar um PDF e extrai texto real", async () => {
    const result = await parsePDF(textPdf());
    expect(result.pageCount).toBe(1);
    expect(result.text).toContain("Burger 24 BRL");
    expect(result.text).toContain("selected store");
  }, 20000);
});
