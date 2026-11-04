import { expect, test } from "@playwright/test";

test("cria, edita e exporta um carrossel de demonstração sem credenciais externas", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/app/projects/00000000-0000-4000-8000-000000000001/content");
  await expect(page.getByRole("heading", { name: "SOBE Conteúdo" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Tema").fill("Como escolher um produto para hoje");
  await page.getByRole("button", { name: "Gerar carrossel" }).click();
  await expect(page.getByRole("heading", { name: "Editar card 1" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Título" }).fill("Uma escolha para você");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByRole("status")).toContainText("Rascunho salvo", { timeout: 30_000 });
  const download = page.getByRole("link", { name: "Baixar este card" });
  const response = await page.request.get(await download.getAttribute("href") || "");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/jpeg");
});
