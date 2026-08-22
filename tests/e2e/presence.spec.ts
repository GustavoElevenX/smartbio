import { expect, test } from "@playwright/test";

test("Minha página abre no modo simples e permite editar pela prévia", async ({ page }, testInfo) => {
  await page.goto("/app/projects/demo-casa-sucos/site");
  const create = page.getByRole("button", { name: "Criar página inicial" });
  await expect(create).toBeVisible();
  await create.click();

  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
  await expect(page.getByTestId("site-section-list")).toBeHidden();
  const firstSection = page.locator("[data-editable-presence-section]").first();
  await expect(firstSection).toBeVisible();
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByTestId("simple-editor-backdrop").click({ position: { x: 12, y: 90 } });
  }
  await firstSection.getByRole("button").click();

  const panel = testInfo.project.name === "mobile-chrome"
    ? page.getByRole("dialog", { name: "Editar esta parte" })
    : page.getByTestId("simple-section-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("O que deve acontecer quando alguém clicar aqui?").first()).toBeVisible();
  await expect(panel).not.toContainText("conversionGoalId");
  await expect(panel).not.toContainText("targetStepId");

  const actionSelect = panel.getByLabel("O que deve acontecer quando alguém clicar aqui?").first();
  await actionSelect.selectOption({ index: 1 });
  const selectedGoalId = (await actionSelect.inputValue()).replace("goal:", "");
  expect(selectedGoalId).not.toBe("");
  await panel.getByLabel("Título").fill("Um título editado na própria página");
  await expect(page.getByRole("heading", { name: "Um título editado na própria página" })).toBeVisible();
  await expect(actionSelect).toHaveValue(`goal:${selectedGoalId}`);
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByTestId("simple-editor-backdrop").click({ position: { x: 12, y: 90 } });
  }
  const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/presence/pages/"));
  await page.getByRole("button", { name: "Salvar" }).click();
  const saveResponse = await saved;
  expect(saveResponse.ok()).toBe(true);
  const stored = await saveResponse.json();
  const editedSection = stored.data.sections.find(
    (section: { title?: string }) => section.title === "Um título editado na própria página",
  );
  expect(editedSection?.content.primaryAction?.conversionGoalId).toBe(selectedGoalId);

  await page.getByTestId("site-editor-mode-toggle").click();
  await expect(page.getByTestId("site-editor-advanced")).toBeVisible();
  await page.getByTestId("site-editor-mode-toggle").click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
});

test("Presence entrega conteúdo server-first e abre a jornada sob demanda", async ({
  page,
}) => {
  const response = await page.goto("/virou-presenca-demo");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Sabor de verdade, do seu jeito.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Escolha o que combina com agora",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Continuar atendimento" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Montar meu pedido" }).click();
  await expect(
    page.getByRole("dialog", { name: "Continuar atendimento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fechar atendimento" }),
  ).toBeVisible();
});

test("Presence oferece navegação equivalente em desktop e mobile", async ({
  page,
}) => {
  await page.goto("/virou-presenca-demo");
  if ((page.viewportSize()?.width || 0) < 768) {
    const trigger = page.getByRole("button", { name: "Abrir menu" });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const closeTrigger = page.getByRole("button", { name: "Fechar menu" });
    await expect(closeTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page
        .getByRole("navigation", { name: "Navegação mobile" })
        .getByRole("link", { name: "Escolha o que combina com agora" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Navegação mobile" })
      .getByRole("link", { name: "Escolha o que combina com agora" })
      .click();
    await expect(
      page.getByRole("button", { name: "Abrir menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "Navegação principal" })
        .getByRole("link", { name: "Escolha o que combina com agora" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toHaveCount(
      0,
    );
  }
});

test("Presence publica SEO, canonical e dados estruturados no HTML", async ({
  request,
}) => {
  const response = await request.get("/virou-presenca-demo");
  const html = await response.text();
  expect(html).toContain("Sabor de verdade, do seu jeito.");
  expect(html).toContain('rel="canonical"');
  expect(html).toContain('type="application/ld+json"');
  expect(html).toContain("Casa Mix");
  expect(html).toContain("Logo de Casa Mix");
  expect(html).toContain("Instagram");
});
