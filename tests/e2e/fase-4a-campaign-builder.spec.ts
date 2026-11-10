import { expect, test } from "@playwright/test";

test("modo Simples revisa proposta sem catálogo e salva pelo motor existente", async ({ page }) => {
  await page.route("**/api/ai/projects/*/activations/compose", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ data: { draft: {
      activation: { name: "Avaliação de novembro", title: "Avaliação de novembro", message: "Converse com nossa equipe sobre a avaliação.", activationType: "lead_capture", eligibility: { customerRule: "any" }, limits: {} },
      placements: [{ placementType: "announcement_bar" }],
      reasoning: ["Usa o objetivo de atendimento do negócio."], needsConfirmation: ["Confirme o período da campanha."],
    } } }),
  }));
  await page.goto("/app/projects/demo-activation/activations/new");
  await expect(page.getByRole("heading", { name: "Nova campanha" })).toBeVisible();
  await page.getByLabel("Sua campanha").fill("Quero divulgar nossa avaliação em novembro e receber contatos.");
  await page.getByRole("button", { name: "Propor campanha" }).click();
  await expect(page.getByRole("heading", { name: "Revise a proposta" })).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Avaliação de novembro");
  await expect(page.getByText("Confirme o período da campanha.")).toBeVisible();
  await page.getByLabel("Revisei o conteúdo e as condições desta campanha.").check();
  await page.getByRole("button", { name: "Ver prévia" }).click();
  await expect(page.getByRole("heading", { name: "Prévia e decisão" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toBeVisible();
  await page.getByRole("button", { name: "Modo Avançado" }).click();
  await expect(page.getByText("Passo 1 de 10")).toBeVisible();
  await page.getByRole("button", { name: "8 Resultado" }).click();
  await expect(page.getByText("Limites", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Modo Simples" }).click();
  await page.getByRole("button", { name: "3. Decidir" }).click();
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page).toHaveURL(/\/activations\/(?!new$)[^/]+$/, { timeout: 20_000 });
});
