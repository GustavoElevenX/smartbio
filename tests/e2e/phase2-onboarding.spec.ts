import { expect, test } from "@playwright/test";
import { findDemoProject } from "../../src/data/demo-projects";

test("cria rascunho contextual em três momentos sem editor avançado", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/app/onboarding/ai?new=1");
  await expect(page.getByRole("navigation", { name: "Momentos da configuração" })).toContainText("Conte seu negócio", { timeout: 30_000 });
  await page.getByLabel("Nome do negócio").fill("Doce Ponte Atacado");
  await page.getByLabel("O que você vende e como atende?").fill("Fornecemos sobremesas para restaurantes e cafeterias. Clientes de revenda precisam informar tipo de estabelecimento, volume estimado e local de entrega antes de conversar com a equipe. Não há preço ou frete confirmado no site.");
  await page.locator('label:has(input[name="salesChannel"][value="whatsapp"])').click();
  await page.getByLabel("WhatsApp ou telefone principal").fill("11987654321");
  await page.getByRole("button", { name: "Preparar minha Sobe" }).click();
  await expect(page.getByRole("heading", { name: "Entendi seu negócio assim." })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Sugestão da SOBE · confirme antes de criar")).toBeVisible();
  await expect(page.getByLabel("O que você vende e como atende?")).toBeHidden();
  await page.getByRole("button", { name: "Criar com essa proposta" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Teste os caminhos do visitante" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exemplo de briefing para a equipe" })).toBeVisible();
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
  await expect(page.getByText(/Simulação local. A mensagem de WhatsApp só será enviada/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("onboarding-teste.png"), fullPage: true });
});

test("versão guiada parte de projeto antigo sem alterá-lo", async ({ page, request }) => {
  const source = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${source.id}`, { data: source });
  await page.goto(`/app/onboarding/ai?new=1&basedOn=${source.id}`);
  await expect(page.getByLabel("Nome do negócio")).toHaveValue(source.name);
  await expect(page.getByLabel("O que você vende e como atende?")).toHaveValue(source.description);
  const persisted = await request.get(`/api/projects/${source.id}`);
  expect(persisted.ok()).toBe(true);
  const body = await persisted.json() as { data: { name: string; description: string } };
  expect(body.data.name).toBe(source.name);
  expect(body.data.description).toBe(source.description);
});
