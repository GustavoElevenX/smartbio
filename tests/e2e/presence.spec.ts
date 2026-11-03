import { expect, test } from "@playwright/test";
import { findDemoProject } from "../../src/data/demo-projects";

test.afterEach(async ({ request }) => {
  // The local API now persists editor saves across requests. Restore this
  // shared demo so later public-flow tests see their original fixture.
  const project = findDemoProject("demo-casa-sucos")!;
  const response = await request.put(`/api/projects/${project.id}`, { data: project });
  expect(response.ok()).toBe(true);
});

test("Minha página diferencia os modos rápido e avançado", async ({ page }, testInfo) => {
  await page.goto("/app/projects/demo-casa-sucos/site");
  const create = page.getByRole("button", { name: "Criar página inicial" });
  await expect(create).toBeVisible();
  await create.click();

  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
  await expect(page.getByRole("button", { name: "Modo rápido", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Edite o essencial direto na prévia.")).toBeAttached();
  await expect(page.getByTestId("site-section-list")).toBeHidden();
  const firstSection = page.locator("[data-editable-presence-section]").first();
  await expect(firstSection).toBeVisible();
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByTestId("simple-editor-backdrop").click({ position: { x: 12, y: 90 } });
  }
  await firstSection.getByRole("button", { name: /^Editar / }).click();

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
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Casa de Sucos Mix · Salvo/)).toBeAttached();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Um título editado na própria página" })).toBeVisible();
  const savedGoal = await page.evaluate(() => {
    const projects = JSON.parse(localStorage.getItem("smartbio:projects:v3") || "[]");
    return projects.find((project: { id: string }) => project.id === "demo-casa-sucos")?.presence?.pages.flatMap((page: { sections: unknown[] }) => page.sections).find((section: { title: string }) => section.title === "Um título editado na própria página")?.content.primaryAction?.conversionGoalId;
  });
  expect(savedGoal).toBe(selectedGoalId);

  await page.getByTestId("site-editor-mode-toggle").click();
  await expect(page.getByTestId("site-editor-advanced")).toBeVisible();
  await expect(page.getByRole("button", { name: "Modo avançado", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Controle toda a estrutura da página.")).toBeAttached();
  await page.getByTestId("site-editor-mode-toggle").click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
});

test("Minha página permite configurar um link externo seguro", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/app/projects/demo-casa-sucos/site");
  await expect(page).toHaveURL(/\/app\/projects\/demo-casa-sucos\/site$/);
  await expect(page).toHaveTitle(/Minha página/);
  await expect(page.getByText(/Unhandled Runtime Error|Build Error/)).toHaveCount(0);
  await page.getByRole("button", { name: "Criar página inicial" }).click();

  const firstSection = page.locator("[data-editable-presence-section]").first();
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByTestId("simple-editor-backdrop").click({ position: { x: 12, y: 90 } });
  }
  await firstSection.getByRole("button", { name: /^Editar / }).click();
  const panel = testInfo.project.name === "mobile-chrome"
    ? page.getByRole("dialog", { name: "Editar esta parte" })
    : page.getByTestId("simple-section-panel");

  await panel.getByLabel("O que deve acontecer quando alguém clicar aqui?").first().selectOption("direct:url");
  const destination = panel.getByLabel("Link de destino").first();
  await destination.fill("exemplo.com/cardapio");
  await destination.blur();
  await expect(destination).toHaveValue("https://exemplo.com/cardapio");
  await expect(panel.getByRole("link", { name: "Testar" })).toHaveAttribute("href", "https://exemplo.com/cardapio");
  await expect(panel.getByText("A página será aberta em uma nova aba.")).toBeVisible();

  await destination.fill("javascript:alert(1)");
  await destination.blur();
  await expect(destination).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByText(/Use um link válido/)).toBeVisible();

  await destination.fill("loja.exemplo.com/produto");
  await destination.blur();
  await expect(destination).toHaveValue("https://loja.exemplo.com/produto");
  if (process.env.EXTERNAL_LINK_QA_SCREENSHOT && testInfo.project.name === "desktop-chrome") {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: process.env.EXTERNAL_LINK_QA_SCREENSHOT, fullPage: false });
  }
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByTestId("simple-editor-backdrop").click({ position: { x: 12, y: 90 } });
  }
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Casa de Sucos Mix · Salvo/)).toBeAttached();
  if (testInfo.project.name === "desktop-chrome") {
    await page.context().route("https://loja.exemplo.com/**", (route) => route.fulfill({ status: 200, body: "Destino externo de teste" }));
    await page.goto("/casadesucosmix");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Abrir link" }).first().click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL("https://loja.exemplo.com/produto");
    await popup.close();
  }
  expect(browserErrors).toEqual([]);
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
    page.getByRole("button", { name: "Fechar", exact: true }),
  ).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Continuar atendimento" });
  await page.keyboard.press("Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Montar meu pedido" })).toBeFocused();
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

test("CSS-ONLY: wrapping tipográfico isolado em demos, sem evidência de Activation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Regressão específica de viewport mobile");
  test.setTimeout(90_000);
  const names = [
    "Assistência Técnica Oficina Pedal Livre Bike Shop",
    "Studio Nexo Interiores e Arquitetura",
    "Clínica de Estética Integrada Aurora",
  ];

  for (const route of ["/virou-presenca-demo", "/limpabem"]) {
    await page.goto(route);
    for (const width of [360, 375, 390]) {
      await page.setViewportSize({ width, height: 820 });
      const hero = page.getByRole("heading", { level: 1 }).first();
      await expect(hero).toBeVisible();
      for (const name of names) {
        await hero.evaluate((element, nextName) => { element.textContent = nextName; }, name);
        const metrics = await hero.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const node = element.firstChild;
          const text = node?.textContent || "";
          const word = text.split(/\s+/).find((part) => part.startsWith("Assistência")) || text.split(/\s+/)[0] || "";
          const start = text.indexOf(word);
          const range = document.createRange();
          if (node && start >= 0) {
            range.setStart(node, start);
            range.setEnd(node, start + word.length);
          }
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            left: rect.left,
            right: rect.right,
            splitWord: range.getClientRects().length > 1,
          };
        });
        expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
        expect(metrics.left).toBeGreaterThanOrEqual(-1);
        expect(metrics.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
        expect(metrics.splitWord).toBe(false);
      }
      const cardTitle = page.locator("article h3").first();
      if (await cardTitle.count()) {
        await cardTitle.evaluate((element) => { element.textContent = "Avaliação detalhada antes do serviço recomendado"; });
        const cardMetrics = await cardTitle.evaluate((element) => {
          const article = element.closest("article");
          return {
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
            clipped: Boolean(article && (article.scrollWidth > article.clientWidth || article.scrollHeight > article.clientHeight)),
          };
        });
        expect(cardMetrics.documentWidth).toBeLessThanOrEqual(cardMetrics.viewportWidth);
        expect(cardMetrics.clipped).toBe(false);
      }
    }
  }
});
