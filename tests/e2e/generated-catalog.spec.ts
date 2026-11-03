import { expect, test } from "@playwright/test";
import path from "node:path";
import { findDemoProject } from "../../src/data/demo-projects";
import type { CommercialArchitecture } from "../../src/features/ai-setup/ai-setup.schema";
import { RuleBasedBusinessAnalyzer } from "../../src/features/business-understanding/rule-based-business-analyzer";
import { journeyComposer } from "../../src/features/composition/journey-composer";

test("jornada gerada abre catálogo direto, seleciona sabores e encaminha quantidades independentes", async ({ page, request, context }, testInfo) => {
  const original = findDemoProject("demo-casa-sucos")!;
  const evidence = [{ sourceId: "test", origin: "user" as const, excerpt: "Dados fictícios de teste", confidence: 1 }];
  const architecture: CommercialArchitecture = {
    status: "ready", confidence: 1,
    businessSummary: { whatItSells: "Sucos naturais — dados de teste", commercialModel: "Pedidos pelo WhatsApp", evidence },
    offerings: [{ id: "suco", name: "Suco natural", kind: "product", description: "Escolha o sabor", price: 10, priceMode: "fixed", variants: [
      { id: "laranja", name: "Laranja", priceDelta: 0, isAvailable: true },
      { id: "uva", name: "Uva", priceDelta: 2, isAvailable: true },
      { id: "manga", name: "Manga", priceDelta: 0, isAvailable: false },
    ], evidence, confidence: 1 }],
    audienceContexts: [], locations: [], issues: [],
    channels: [{ id: "wa", type: "whatsapp", label: "Atendimento", value: "5511999999999", purpose: "Pedidos", isFallback: true, evidence, confidence: 1 }],
    intents: [{ id: "pedido", semanticKey: "order", label: "Escolher produtos", visitorNeed: "Escolher sabores e quantidades", priority: 100, visibleOnEntry: true, evidence, confidence: 1 }],
    journeyBlueprints: [{ id: "bp-pedido", intentId: "pedido", objective: "Selecionar e pedir", mode: "catalog", steps: [{ purpose: "Selecione os sabores e as quantidades", title: "Escolha seus sucos", expectedCapability: "catalog_order", collects: [], usesOfferings: ["suco"], usesLocations: [] }], completion: { type: "whatsapp", channelId: "wa", destinationStrategy: "fixed", handoffSummary: true }, requiredFacts: [], assumptions: [], confidence: 1 }],
  };
  const input = { businessName: original.name, businessDescription: "Sucos naturais — dados fictícios de teste", primaryGoal: "Escolher produtos", primaryDestination: "WhatsApp", slug: original.slug };
  const composition = journeyComposer.compose(input, new RuleBasedBusinessAnalyzer().analyze(input), [], architecture);
  const project = { ...original, presence: undefined, conversionGoals: [], entryPoints: [], steps: composition.steps, commercialConfig: composition.commercialConfig, publication: { homeMode: "step" as const, initialStepId: composition.steps[0].id } };
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await context.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>WhatsApp de teste</title><h1>Mensagem interceptada no teste</h1>" }));
  try {
    const saved = await request.put(`/api/projects/${project.id}`, { data: project });
    expect(saved.ok()).toBe(true);
    await page.addInitScript((seed) => localStorage.setItem("smartbio:projects:v3", JSON.stringify([seed])), project);
    await page.goto(`/${project.slug}`);
    await expect(page).toHaveTitle(new RegExp(original.name));
    await expect(page.getByRole("heading", { name: original.name, exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^Escolher produtos/ }).click();
    await expect(page.getByRole("heading", { name: "Escolha seus sucos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar Suco natural · Manga", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByText("Escolha ao menos um item para continuar.")).toBeVisible();
    await page.getByRole("button", { name: "Adicionar Suco natural · Laranja", exact: true }).click();
    await expect(page.getByText("Escolha ao menos um item para continuar.")).toHaveCount(0);
    await page.getByRole("button", { name: "Adicionar Suco natural · Uva", exact: true }).click();
    await page.getByRole("button", { name: "Aumentar Suco natural · Laranja", exact: true }).click();
    await expect(page.getByText("3 na seleção", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Diminuir Suco natural · Laranja" }).locator("..")).toContainText("2");
    await expect(page.getByRole("button", { name: "Diminuir Suco natural · Uva" }).locator("..")).toContainText("1");
    await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    if (process.env.QA_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.QA_SCREENSHOT_DIR, `generated-catalog-${testInfo.project.name}.png`), fullPage: true });
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Confira e continue" })).toBeVisible();
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Continuar no WhatsApp", exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    const message = new URL(popup.url()).searchParams.get("text") || "";
    expect(message).toContain("2x Suco natural · Laranja");
    expect(message).toContain("1x Suco natural · Uva");
    expect(browserErrors).toEqual([]);
  } finally {
    await request.put(`/api/projects/${original.id}`, { data: original }).catch(() => undefined);
  }
});
