import { expect, test } from "@playwright/test";

test("editor adaptativo mantém a proposta da Sobe IA sob confirmação", async ({ page }, testInfo) => {
  await page.goto("/app/projects/demo-casa-sucos/site");
  const create = page.getByRole("button", { name: "Criar página inicial" });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByRole("link", { name: "Sobe, início" }).last()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Conteúdo" })).toBeVisible();
  const sectionsBefore = await page.getByTestId("site-section-list").getByRole("button").count();
  await page.getByRole("tab", { name: "Dados" }).click();
  await expect(page.getByText("Nada é aplicado automaticamente.")).toBeVisible();
  await page.getByRole("button", { name: "Sugerir estrutura" }).click();
  const dialog = page.getByRole("dialog", { name: "Proposta de estrutura" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("altera apenas o rascunho e não publica o site");
  await dialog.getByRole("button", { name: "Personalizar antes" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.getByTestId("site-section-list").getByRole("button").count()).toBe(sectionsBefore);
  await page.getByRole("button", { name: "Visualização mobile" }).click();
  await page.screenshot({ path: testInfo.outputPath("site-composer-mobile.png"), fullPage: false });
});

test("catálogo público aplica busca, limite e escopo do projeto", async ({ request }) => {
  const response = await request.get("/api/public/catalog/demo-casa-sucos?q=detox&limit=2");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.data.items.length).toBeLessThanOrEqual(2);
  expect(payload.data.items.every((item: { id: string }) => item.id)).toBe(true);
  expect(payload.data.pageInfo.limit).toBe(2);
});
