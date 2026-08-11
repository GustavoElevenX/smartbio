import { expect, test } from "@playwright/test";

test("onboarding adaptativo funciona sem login e gera um rascunho", async ({ page }) => {
  await page.goto("/app/onboarding");
  await expect(page).toHaveURL(/\/app\/onboarding\/ai$/);
  await expect(page.getByRole("heading", { name: /vamos entender o seu negócio/i })).toBeVisible();

  await page.getByLabel("Nome do negócio").fill("Clínica Horizonte");
  await page.getByLabel("O que você vende e como atende?").fill("Clínica de fisioterapia que atende por horário e recebe solicitações de avaliação pelo WhatsApp.");
  await page.getByLabel("WhatsApp ou telefone (opcional)").fill("5511999999999");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.getByText(/leitura do negócio/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /perguntas para avançar/i })).toBeVisible();
  await page.getByRole("button", { name: /gerar jornada adaptativa/i }).click();

  await expect(page.getByRole("heading", { name: /a jornada foi criada sem publicar nada/i })).toBeVisible({ timeout: 30_000 });
  const editor = page.getByRole("button", { name: /abrir jornada/i });
  await expect(editor).toBeVisible();
  await editor.click();
  await expect(page).toHaveURL(/\/app\/projects\/.+\/editor$/);
});
