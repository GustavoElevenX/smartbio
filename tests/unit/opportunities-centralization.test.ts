import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("central de oportunidades", () => {
  it("mantém uma única entrada visível para contatos comerciais", () => {
    const legacyRoute = read(
      "src/app/app/projects/[projectId]/leads/page.tsx",
    );
    const projectsList = read("src/components/dashboard/projects-list.tsx");

    expect(legacyRoute).toContain(
      "redirect(`/app/projects/${projectId}/opportunities`)",
    );
    expect(legacyRoute).not.toContain("LeadsDashboard");
    expect(projectsList).toContain(
      "href={`/app/projects/${project.id}/opportunities`}",
    );
    expect(projectsList).not.toContain(
      "href={`/app/projects/${project.id}/leads`}",
    );
  });

  it("expõe e permite buscar os dados recebidos do contato", () => {
    const page = read(
      "src/components/opportunities/opportunities-page.tsx",
    );
    const details = read(
      "src/components/opportunities/opportunity-details.tsx",
    );

    expect(page).toContain("item.contactEmail");
    expect(page).toContain("item.contactPhone");
    expect(details).toContain("opportunity.contactEmail");
    expect(details).toContain("opportunity.contactPhone");
    expect(details).toContain("https://wa.me/${whatsappPhone}");
  });

  it("preserva nome, telefone e e-mail ao migrar leads antigos", () => {
    const backfill = read("scripts/backfill-opportunities.ts");

    expect(backfill).toContain("name,email,phone,company");
    expect(backfill).toContain("patch.contact_email = contactEmail");
    expect(backfill).toContain("patch.contact_phone = contactPhone");
  });
});
