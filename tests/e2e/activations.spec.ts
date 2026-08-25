import { expect, test } from "@playwright/test";

test("Casa de Sucos: benefício segue até o handoff humano com claim atribuído", async ({ page, request }) => {
  const activationResponse = await request.post("/api/projects/demo-activation/activations", {
    data: {
      name: `Primeira compra ${Date.now()}`,
      activationType: "promotion",
      conversionGoalId: "mix-goal-resale",
      defaultDestinationId: "mix-commercial-whatsapp",
      title: "20% na primeira compra",
      message: "Valide seu WhatsApp e continue com o atendimento comercial.",
      requiresIdentity: true,
      identityMode: "phone",
      completionChannel: "whatsapp",
      eligibility: { customerRule: "first_purchase_via_virou" },
      offers: [{ offerType: "percentage_discount", label: "20% OFF", percentage: 20, currency: "BRL", scope: {}, benefitConfig: {}, isActive: true }],
      placements: [{ placementType: "hero_override", content: { ctaLabel: "Liberar 20% OFF" }, style: {}, priority: 100, isActive: true }],
      settings: { conversionPolicy: "redemption_marks_conversion" },
    },
  });
  expect(activationResponse.status()).toBe(201);
  const created = await activationResponse.json() as { data: { activation: { id: string } } };
  const activationId = created.data.activation.id;
  const publishResponse = await request.post(`/api/projects/demo-activation/activations/${activationId}/publish`);
  expect(publishResponse.ok()).toBeTruthy();

  await page.route("**/api/public/activations/*/claim", async (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, data: { eligible: true, claim: { id: "10000000-0000-4000-8000-000000000001", code: "VIR0U7X", benefitLabel: "20% OFF" } } }) }));
  await page.route("**/api/public/activations/*/handoff", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { presented: true, opportunityId: "opportunity-e2e" } }) }));
  await page.context().route(/https:\/\/(wa\.me|api\.whatsapp\.com)\//, async (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>WhatsApp</title>",
  }));

  await page.goto("/virou-activation-demo");
  await page.getByRole("button", { name: "Liberar 20% OFF" }).click();
  await page.getByRole("textbox", { name: "WhatsApp" }).fill("(11) 99999-2002");
  await page.getByRole("button", { name: /verificar meu benefício/i }).click();
  await expect(page.getByText("VIR0U7X")).toBeVisible();
  await page.getByRole("button", { name: /agora continue seu pedido/i }).click();

  await page.getByLabel("Seu negócio é").selectOption("Academia");
  await page.getByRole("radio", { name: "Até 30 unidades" }).check();
  await page.getByRole("radio", { name: "WhatsApp" }).check();
  await page.getByRole("button", { name: /ver sugestão/i }).click();
  const handoff = page.waitForRequest("**/api/public/activations/*/handoff");
  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: /falar com atendimento comercial/i }).click();
  const handoffRequest = await handoff;
  expect(handoffRequest.postDataJSON()).toMatchObject({ claimId: "10000000-0000-4000-8000-000000000001", conversionGoalId: "mix-goal-resale" });
  await expect(await popup).toHaveURL(/(wa\.me\/5511999992002|api\.whatsapp\.com\/send\/\?phone=5511999992002)/);
});
