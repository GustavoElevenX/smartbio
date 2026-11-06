import { expect, test } from "@playwright/test";

test("menu lateral organiza a navegação e mantém o modo recolhido", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Fluxo exclusivo do desktop");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/app/projects/demo-casa-sucos/minha-sobe");

  const sidebar = page.getByRole("complementary", { name: "Menu lateral" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "272px");
  await expect(
    sidebar.getByRole("link", { name: "Minha SOBE" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(sidebar.getByText("Proprietário")).toBeVisible();

  await sidebar.getByRole("button", { name: "Recolher menu lateral" }).click();
  await expect(sidebar).toHaveCSS("width", "84px");
  const expandButton = sidebar.getByRole("button", { name: "Expandir menu lateral" });
  const sidebarBounds = await sidebar.boundingBox();
  const expandBounds = await expandButton.boundingBox();
  expect(sidebarBounds && expandBounds).toBeTruthy();
  expect(expandBounds!.x + expandBounds!.width).toBeLessThanOrEqual(
    sidebarBounds!.x + sidebarBounds!.width,
  );
  await expect(
    sidebar.getByRole("link", { name: "Minha SOBE" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("sobe:sidebar-collapsed")))
    .toBe("true");

  await page.reload();
  await expect(sidebar).toHaveCSS("width", "84px");
  await sidebar.getByRole("button", { name: "Expandir menu lateral" }).click();
  await expect(sidebar).toHaveCSS("width", "272px");

  await page.goto("/app/settings/billing");
  await expect(
    sidebar.getByRole("link", { name: "Plano e cobrança" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    sidebar.getByRole("link", { name: "Configurações", exact: true }),
  ).not.toHaveAttribute("aria-current", "page");

  await sidebar.screenshot({
    path: testInfo.outputPath("menu-lateral-desktop.png"),
  });
  await page.goto("/app/projects/new");
  await expect(sidebar.getByRole("link", { name: "Visão geral" })).toHaveCount(0);
  await expect(page.locator("header")).toContainText("Novo negócio");
  expect(consoleErrors).toEqual([]);
});

test("menu móvel controla foco, rolagem e fechamento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Fluxo exclusivo do celular");
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/app/projects/demo-casa-sucos/minha-sobe");
  const trigger = page.getByRole("button", { name: "Abrir menu" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Menu principal" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await expect(dialog.getByRole("button", { name: "Fechar menu" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect
    .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);

  await page.screenshot({
    path: testInfo.outputPath("menu-lateral-mobile.png"),
    fullPage: true,
  });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(dialog).toBeHidden();
  await page.setViewportSize({ width: 393, height: 851 });

  await trigger.click();
  await dialog.getByRole("link", { name: "Início", exact: true }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/app$/);
  expect(consoleErrors).toEqual([]);
});
