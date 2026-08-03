import { expect, test } from "@playwright/test";

test("Vértice qualifica, recomenda e oferece WhatsApp", async ({ page }) => {
  await page.goto("/vertice?utm_source=instagram&utm_campaign=e2e");
  await expect(page.getByRole("heading", { name: /destravar no seu negócio/i })).toBeVisible();
  await page.getByRole("button", { name: /gerar mais leads/i }).click();
  await page.getByLabel("Qual é o seu negócio?").fill("SaaS B2B");
  await page.getByLabel("Investimento mensal em marketing").selectOption("R$ 10–30 mil");
  await page.getByLabel("Objetivo principal").selectOption("Gerar leads");
  await page.getByRole("radio", { name: "WhatsApp" }).check();
  await page.getByRole("button", { name: /ver diagnóstico/i }).click();
  await expect(page.getByText("Tráfego Pago + Social Media")).toBeVisible();
});

test("Casa de Sucos leva do pedido à unidade e produtos", async ({ page }) => {
  await page.goto("/casadesucosmix");
  await page.getByRole("button", { name: /pedir agora/i }).click();
  await page.getByRole("button", { name: /delivery/i }).click();
  await expect(page.getByText("Golden Shopping")).toBeVisible();
  await page.getByRole("button", { name: /ver produtos/i }).click();
  await expect(page.getByText("Suco natural")).toBeVisible();
});
