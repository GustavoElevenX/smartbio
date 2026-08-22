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
  await expect(page.getByText("Recomendamos de 2 a 5 ações")).toBeVisible();
  await page.getByRole("button", { name: /editar informações do negócio/i }).click();
  await expect(page.getByLabel("O que você vende e como atende?")).toBeEnabled();
  await page.getByLabel("O que você vende e como atende?").fill("Clínica de fisioterapia que atende por horário, recebe avaliações pelo WhatsApp e também vende planos de acompanhamento.");
  await page.getByRole("button", { name: /analisar novamente/i }).click();
  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Roteamento", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /pronto para montar a primeira versão/i })).toBeVisible();
  await page.getByRole("button", { name: /criar minha primeira versão/i }).click();

  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /sua primeira versão está pronta/i })).toBeVisible();
  await expect(page.getByText(/pronto para publicar:/i)).toBeVisible();
  await page.getByRole("link", { name: "Editar página" }).click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
});

test("orienta quando há ações demais e aceita uma ação personalizada", async ({ page }) => {
  await page.goto("/app/onboarding/ai?new=1");
  await page.getByLabel("Nome do negócio").fill("Ateliê Norte");
  await page.getByLabel("O que você vende e como atende?").fill("Ateliê que vende peças autorais, mostra catálogo e recebe pedidos e orçamentos pelo WhatsApp.");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();
  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });

  const actions = page.getByRole("region", { name: /o que você quer que essa pessoa consiga fazer/i });
  while (await actions.locator('button[aria-pressed="true"]').count() < 6) {
    await actions.getByRole("button", { name: /^Adicionar / }).first().click();
  }
  await expect(actions.getByRole("alert")).toContainText("Muitas opções podem deixar a primeira página confusa");

  const otherToggle = actions.getByRole("button", { name: /^(Adicionar|Remover) Outro$/ });
  if ((await otherToggle.getAttribute("aria-label"))?.startsWith("Adicionar")) await otherToggle.click();
  await actions.getByLabel("Descreva a outra ação").fill("Baixar catálogo");
  await expect(actions.getByLabel("Descreva a outra ação")).toHaveValue("Baixar catálogo");
});
