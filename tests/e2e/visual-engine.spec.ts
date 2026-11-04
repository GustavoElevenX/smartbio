import { expect, test } from "@playwright/test";

test("cria três artes, edita, aprova e exporta PNG no modo de demonstração", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/app/projects/00000000-0000-4000-8000-000000000001/visuals");
  await expect(page.getByRole("heading", { name: "Artes para o seu negócio" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Título (opcional)" }).fill("Nova coleção da casa");
  await page.getByRole("button", { name: "Gerar três alternativas grátis" }).click();
  await expect(page.getByText("3 alternativas criadas")).toBeVisible({ timeout: 30_000 });
  expect(await page.getByRole("button", { name: /Nova coleção da casa/ }).count()).toBeGreaterThanOrEqual(3);
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Coleção para você");
  await page.getByRole("button", { name: "Salvar e regenerar" }).click();
  await expect(page.getByText("Alterações salvas.", { exact: false })).toBeVisible({ timeout: 30_000 });
  const href = await page.getByRole("link", { name: "Baixar PNG" }).getAttribute("href");
  const response = await page.request.get(href || "");
  expect(response.ok(), `PNG HTTP ${response.status()}: ${await response.text()}`).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  await page.getByRole("button", { name: "Aprovar esta arte" }).click();
  await expect(page.getByText("Arte aprovada", { exact: true })).toBeVisible({ timeout: 30_000 });
});
