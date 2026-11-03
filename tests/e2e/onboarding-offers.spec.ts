import { expect, test } from "@playwright/test";

test("ofertas podem ser descritas ou importadas e a revenda não duplica o catálogo", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  await page.goto("/app/onboarding/ai?new=1");
  await expect(page.getByRole("heading", { name: "Vamos montar a sua Sobe." })).toBeVisible();
  await page.getByLabel("Nome do negócio").fill("Casa de Sucos Mix");
  await page.locator('label:has(input[name="offeringType"][value="products"])').click();
  await page.getByLabel("O que você vende e como atende?").fill("Preparamos sucos, lanches e saladas para consumo e também fornecemos parte da linha para revenda.");

  await expect(page.getByLabel("Seus produtos", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Escrever ou colar/ }).click();
  await page.getByLabel("Seus produtos", { exact: true }).fill("Suco natural de laranja e abacaxi\nSanduíche natural\nSalada de frutas");
  await page.locator('label:has(input[name="resaleAvailable"])').filter({ hasText: "Sim" }).click();
  await page.getByLabel(/O que o revendedor precisa saber/).fill("Somente sucos são para revenda. Embalagens e pedido mínimo sob consulta.");

  await page.getByRole("button", { name: /Aproveitar material pronto/ }).click();
  await expect(page.getByText("Materiais do negócio")).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar este endereço" })).toBeVisible();
  const evidenceDir = process.env.QA_EVIDENCE_DIR;
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-importar.png`, fullPage: true });
  await page.getByRole("button", { name: /Escrever ou colar/ }).click();
  await expect(page.getByLabel("Seus produtos", { exact: true })).toHaveValue(/Suco natural de laranja/);
  await expect(page.getByLabel(/O que o revendedor precisa saber/)).toHaveValue(/Somente sucos/);

  const sessionId = await page.evaluate(() => {
    const raw = localStorage.getItem("smartbio:last-ai-setup-session");
    return raw ? (JSON.parse(raw) as { sessionId?: string }).sessionId : undefined;
  });
  expect(sessionId).toBeTruthy();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/ai/setup/${sessionId}`);
    if (!response.ok()) return null;
    const payload = await response.json() as { data?: { initialInput?: { offerDetails?: string; resaleAvailable?: boolean; resaleDetails?: string } } };
    return payload.data?.initialInput || null;
  }).toMatchObject({
    offerDetails: "Suco natural de laranja e abacaxi\nSanduíche natural\nSalada de frutas",
    resaleAvailable: true,
    resaleDetails: "Somente sucos são para revenda. Embalagens e pedido mínimo sob consulta.",
  });

  await page.reload();
  await expect(page.getByLabel("Seus produtos", { exact: true })).toHaveValue(/Suco natural de laranja/);
  await expect(page.locator('input[name="resaleAvailable"]:checked')).toHaveValue("on");
  await expect(page.getByLabel(/O que o revendedor precisa saber/)).toHaveValue(/Somente sucos/);
  expect(runtimeErrors).toEqual([]);
  if (evidenceDir) await page.screenshot({ path: `${evidenceDir}/${testInfo.project.name}-ofertas.png`, fullPage: true });
});
