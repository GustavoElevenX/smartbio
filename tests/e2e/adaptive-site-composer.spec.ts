import { expect, test } from "@playwright/test";

test("editor adaptativo mantém a proposta da Sobe IA sob confirmação", async ({ page }, testInfo) => {
  await page.goto("/app/projects/demo-casa-sucos/site");
  const create = page.getByRole("button", { name: "Criar página inicial" });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page.getByRole("link", { name: "Sobe, início" }).last()).toBeVisible();
  if (testInfo.project.name === "mobile-chrome") await page.getByRole("button", { name: "Propriedades" }).click();
  await expect(page.getByRole("tab", { name: "Conteúdo" })).toBeVisible();
  const sectionsBefore = await page.getByTestId("site-section-list").getByRole("button").count();
  await page.getByRole("tab", { name: "Avançado" }).click();
  const instruction = page.getByRole("textbox", { name: "Instrução para a Sobe IA" });
  await expect(instruction).toBeVisible();
  await instruction.fill("Crie uma landing para revendedores e remova o FAQ.");
  await page.getByRole("button", { name: "Criar landing" }).click();
  await page.getByRole("button", { name: "Gerar proposta" }).click();
  const dialog = page.getByRole("dialog", { name: "Revise a proposta" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("nunca publica o site");
  await expect(dialog).toContainText("Diff semântico");
  await dialog.getByRole("button", { name: "Personalizar antes" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox").first()).toBeVisible();
  await dialog.getByRole("button", { name: "Descartar" }).click();
  expect(await page.getByTestId("site-section-list").getByRole("button").count()).toBe(sectionsBefore);
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("button", { name: "Fechar propriedades" }).click();
    await page.getByRole("button", { name: "Conteúdo", exact: true }).click();
    const sectionsDrawer = page.getByRole("dialog", { name: "Conteúdo desta página" });
    await expect(sectionsDrawer).toBeVisible();
    await sectionsDrawer.getByRole("button", { name: "Transforme interesse em ação" }).click();
    await expect(page.getByRole("dialog", { name: "Propriedades" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar propriedades" }).click();
  }
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

test("performance retorna evidência sem quebrar no modo local", async ({ request }) => {
  const response = await request.get("/api/projects/demo-casa-sucos/optimization");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.data).toHaveProperty("evidence");
  expect(payload.data).toHaveProperty("suggestions");
  const explanation = await request.post("/api/projects/demo-casa-sucos/optimization/explain", { data: { suggestionId: "not-yet-eligible" } });
  expect(explanation.status()).toBe(409);
});
