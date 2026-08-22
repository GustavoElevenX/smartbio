import { expect, test } from "@playwright/test";

test("onboarding adaptativo funciona sem login e gera um rascunho", async ({ page }) => {
  await page.goto("/app/onboarding");
  await expect(page).toHaveURL(/\/app\/onboarding\/ai$/);
  await expect(page.getByRole("heading", { name: /vamos montar a sua sobe/i })).toBeVisible();

  await page.getByLabel("Nome do negócio").fill("Clínica Horizonte");
  await page.getByLabel("O que você vende e como atende?").fill("Clínica de fisioterapia que atende por horário e recebe solicitações de avaliação pelo WhatsApp.");
  await page.getByLabel("WhatsApp ou telefone (opcional)").fill("5511999999999");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /pronto para montar a primeira versão/i })).toBeVisible();
  await page.getByRole("button", { name: /criar minha primeira versão/i }).click();

  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /sua primeira versão está pronta/i })).toBeVisible();
  await expect(page.getByText(/pronto para publicar:/i)).toBeVisible();
  await page.getByRole("link", { name: "Editar página" }).click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
});
