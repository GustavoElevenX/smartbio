import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
const landing = readFileSync(resolve(process.cwd(), "src/components/marketing/virou-landing.tsx"), "utf8");
const brand = readFileSync(resolve(process.cwd(), "src/components/ui/brand.tsx"), "utf8");
const palette = readFileSync(resolve(process.cwd(), "src/components/marketing/virou-landing.module.css"), "utf8");
const simulation = readFileSync(resolve(process.cwd(), "src/components/marketing/journey-simulation.tsx"), "utf8");

describe("SOBE landing — Arquitetura da Atenção", () => {
  it("preserves the approved direction, official logo and proprietary gradient", () => {
    expect(layout).toContain("SOBE — Transforme atração em ação");
    expect(layout).toContain("IMPECCABLE_DIRECTION 430f8e2e");
    expect(landing).toContain("Transforme<br />atração em <span>ação.</span>");
    expect(landing).toContain("/visuals/attention-gate.png");
    expect(brand).toContain("/brand/sobe-symbol.png");
    expect(brand).toContain("quality={90}");
    expect(brand).toContain(">SOBE</span>");
    expect(palette).toContain("#02e5cd 0%, #01d2df 34%, #0186fc 68%, #0054fc 100%");
  });

  it("keeps the reference narrative order without fictitious business examples", () => {
    const sections = ["<Hero />", "<Problem />", "<Mechanism />", "<Possibilities />", "<BuildRoute />", "<Pricing />", "<Faq />", "<FinalCta />"];
    const positions = sections.map((section) => landing.lastIndexOf(section));
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(landing).not.toMatch(/Casa de Sucos Mix|Vértice|Clínica Aurora|Chalés Serra Clara/);
  });

  it("presents one plan and the brand-led commercial promise", () => {
    expect(landing).toContain("Um plano. Tudo que você precisa para começar.");
    expect(landing).toContain("SOBE_BRAND_PROMISE");
    expect(landing).toContain("Começar {SOBE_TRIAL.days} dias grátis");
    expect(landing).not.toMatch(/R\$ 59|R\$ 149|Business|Free/);
  });

  it("ships the real choice → context → action simulation", () => {
    expect(landing).toContain("<JourneySimulation />");
    expect(simulation).toContain("Como podemos ajudar?");
    expect(simulation).toContain("Pedir orçamento");
    expect(simulation).toContain("Escolher um horário");
    expect(simulation).toContain("Ver produtos");
    expect(simulation).toContain("Pronto para o próximo passo?");
  });

  it("recomposes the dispersed-attention routes vertically on mobile", () => {
    expect(landing).toContain("styles.mobileScatterRoutes");
    expect(landing).toContain('cx="280" cy="424"');
    expect(palette).toContain(".desktopScatterRoutes { display: none; }");
    expect(palette).toContain(".mobileScatterRoutes { display: inline; }");
  });
});
