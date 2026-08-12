import { expect, test } from "@playwright/test";

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
