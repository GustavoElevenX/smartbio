import { expect, test } from "@playwright/test";

test("usuário cria conta e inicia onboarding", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Seu nome").fill("Pessoa Teste");
  await page.getByLabel("E-mail").fill("teste@smartbio.local");
  await page.locator("#password").fill("segura123");
  await page.getByRole("button", { name: /criar conta grátis/i }).click();
  await expect(page.getByRole("heading", { name: /crie sua experiência/i })).toBeVisible();
  await expect(page.getByText("01 · Identificação")).toBeVisible();
});
