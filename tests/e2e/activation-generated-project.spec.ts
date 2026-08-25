import { expect, test } from "@playwright/test";

test("REAL GENERATED PROJECT E2E — Casa Clara usa o DiscoveryPlan persistido sem contaminar a página", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const suffix = Date.now().toString(36);
  const businessName = `Casa Clara Persianas ${suffix}`;
  const sentinels = ["Casa Mix", "suco detox", "suco de laranja", "limpeza de pele", "banho e tosa"];

  await page.goto("/app/onboarding/ai?new=1");
  await page.getByLabel("Nome do negócio").fill(businessName);
  await page.getByLabel("O que você vende e como atende?").fill("A Casa Clara Persianas oferece soluções sob medida e ajuda o visitante a descobrir qual persiana faz sentido conforme entrada de luz, privacidade e acabamento do ambiente. O atendimento final continua pelo WhatsApp.");
  await page.getByLabel("WhatsApp ou telefone (opcional)").fill("(11) 98765-4321");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 20_000 });
  const removeScheduling = page.getByRole("button", { name: "Remover Agendar", exact: true });
  if (await removeScheduling.count()) await removeScheduling.click();
  const addRecommendation = page.getByRole("button", { name: "Adicionar Receber uma recomendação", exact: true });
  if (await addRecommendation.count()) await addRecommendation.click();
  const prioritizeRecommendation = page.getByRole("button", { name: "Marcar Receber uma recomendação como ação principal", exact: true });
  await prioritizeRecommendation.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const sessionId = await page.evaluate(() => {
    const raw = localStorage.getItem("smartbio:last-ai-setup-session");
    const parsed = raw ? JSON.parse(raw) as { sessionId?: string } : undefined;
    return parsed?.sessionId || "";
  });
  expect(sessionId).not.toBe("");
  await expect.poll(async () => {
    const response = await page.request.get(`/api/ai/setup/${sessionId}`);
    const payload = await response.json() as { data?: { questions?: unknown[] } };
    return payload.data?.questions?.length || 0;
  }).toBeGreaterThan(0);
  await page.goto("/app/onboarding/ai");
  await expect(page.locator("[data-setup-question]").first()).toBeVisible();

  for (let index = 0; index < 10; index += 1) {
    const readyHeading = page.getByRole("heading", { name: /pronto para montar a primeira versão/i });
    const current = page.locator("[data-setup-question]").first();
    await expect.poll(async () => await readyHeading.isVisible().catch(() => false) || await current.isVisible().catch(() => false)).toBe(true);
    if (await readyHeading.isVisible().catch(() => false)) break;
    const text = await current.innerText();
    if (/opções|serviços/i.test(text)) {
      await current.getByPlaceholder("Digite sua resposta…").fill("Persiana Rolô Blackout; Persiana Romana; Persiana Double Vision");
      await current.getByRole("button", { name: /salvar resposta/i }).click();
    } else {
      const suggestion = current.getByRole("button", { name: /usar assim/i });
      if (await suggestion.count()) {
        await suggestion.click();
      } else {
        const input = current.getByPlaceholder("Digite sua resposta…");
        await input.fill(/destino|continua/i.test(text) ? "WhatsApp" : "Confirmado pela Casa Clara");
        await current.getByRole("button", { name: /salvar resposta/i }).click();
      }
    }
    await expect(page.getByText(/salvo\. a sobe atualizou|salvo\. esta confirmação/i)).toBeVisible();
    await page.goto("/app/onboarding/ai");
  }

  await expect(page.getByRole("heading", { name: /pronto para montar a primeira versão/i })).toBeVisible({ timeout: 20_000 });
  const beforeGeneration = await page.request.get(`/api/ai/setup/${sessionId}`);
  const beforePayload = await beforeGeneration.json() as { data: { discoveryPlan?: { id: string; version: number; status: string; offerings: Array<{ id: string; name: string }>; questions: unknown[] } } };
  const persistedPlan = beforePayload.data.discoveryPlan;
  expect(persistedPlan).toMatchObject({ status: "ready", version: 1 });
  expect(persistedPlan?.offerings.map((item) => item.name)).toEqual(["Persiana Rolô Blackout", "Persiana Romana", "Persiana Double Vision"]);
  expect(persistedPlan?.questions).toHaveLength(3);

  await page.getByRole("button", { name: /criar minha primeira versão/i }).click();
  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 40_000 });
  await expect(page.getByRole("heading", { name: /sua primeira versão está pronta/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: businessName, exact: true }).first()).toBeVisible();
  const visiblePage = await page.locator("body").innerText();
  expect(visiblePage).toContain("Persiana Rolô Blackout");
  for (const sentinel of sentinels) expect(visiblePage.toLowerCase()).not.toContain(sentinel.toLowerCase());

  const afterGeneration = await page.request.get(`/api/ai/setup/${sessionId}`);
  const afterPayload = await afterGeneration.json() as { data: { projectDraft: { id: string; discoveryPlan: { id: string; version: number; projectId: string }; commercialConfig: { serviceOfferings: Array<{ id: string; settings: { discoveryPlanId: string } }> } } } };
  const generated = afterPayload.data.projectDraft;
  expect(generated.discoveryPlan.id).toBe(persistedPlan?.id);
  expect(generated.discoveryPlan.version).toBe(persistedPlan?.version);
  expect(generated.discoveryPlan.projectId).toBe(generated.id);
  expect(generated.commercialConfig.serviceOfferings.map((item) => item.id)).toEqual(persistedPlan?.offerings.map((item) => item.id));
  expect(generated.commercialConfig.serviceOfferings.every((item) => item.settings.discoveryPlanId === persistedPlan?.id)).toBe(true);

  for (const width of [360, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.getByRole("link", { name: "Editar página" })).toBeVisible();
  }
  const screenshotPath = process.env.ACTIVATION_GATE_SCREENSHOT_PATH || testInfo.outputPath("casa-clara-generated-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("ACTIVATION_SCREENSHOT_METADATA", JSON.stringify({
    projectName: businessName,
    projectId: generated.id,
    route: `/app/projects/${generated.id}/launch`,
    generatedByPipeline: true,
    viewport: "390x844",
    domTextMutation: false,
    screenshotPath,
  }));

  await page.getByRole("link", { name: "Editar página" }).click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
  await expect(page.getByText(businessName).filter({ visible: true }).first()).toBeVisible();
});
