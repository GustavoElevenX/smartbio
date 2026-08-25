import { expect, test } from "@playwright/test";

test("limpeza recebe orçamento com quantidade e contexto", async ({ page }) => {
  await page.goto("/limpabem?utm_source=instagram&utm_campaign=e2e");
  const quoteStart = page.getByRole("button", { name: /calcular estimativa/i });
  if (await quoteStart.isVisible()) await quoteStart.click();
  await page.getByRole("button", { name: /sofá/i }).click();
  await page.getByLabel("Aumentar quantidade").click();
  await page.getByLabel("Seu nome").fill("Cliente Limpeza");
  await page.getByLabel("WhatsApp").fill("11999990001");
  await page.getByRole("button", { name: /revisar solicitação/i }).click();
  await page.getByRole("button", { name: /enviar pedido de orçamento/i }).click();
  await expect(page.getByText(/orçamento enviado/i)).toBeVisible();
});

test("Vértice qualifica B2B e recomenda próximo passo", async ({ page }) => {
  await page.goto("/vertice?utm_source=instagram&utm_campaign=e2e");
  await expect(page.getByRole("heading", { name: /o que você deseja fazer hoje/i })).toBeVisible();
  await page.getByRole("button", { name: /solicitar diagnóstico/i }).click();
  await page.getByLabel("Qual é o seu negócio?").fill("SaaS B2B");
  await page.getByLabel("Investimento mensal em marketing").selectOption("Acima de R$ 30 mil");
  await page.getByLabel("Objetivo principal").selectOption("Gerar leads");
  await page.getByRole("radio", { name: "WhatsApp" }).check();
  await page.getByRole("button", { name: /ver diagnóstico/i }).click();
  await expect(page.getByText("Tráfego Pago + Social Media")).toBeVisible();
});

test("entrada direta resolve meta sem exibir o seletor geral", async ({ page }) => {
  await page.goto("/casadesucosmix?entry=story-delivery&utm_source=tiktok&utm_campaign=explicita");
  await expect(page.getByRole("heading", { name: /como deseja receber/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /o que você deseja fazer hoje/i })).toHaveCount(0);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("smartbio:events:v3") || "[]") as Array<{ eventName: string; utmSource?: string; utmCampaign?: string; entryPointId?: string }>);
  expect(events.some((event) => event.eventName === "entry_point_loaded" && event.utmSource === "tiktok" && event.utmCampaign === "explicita" && event.entryPointId)).toBe(true);
});

test("delivery monta carrinho e envia pedido", async ({ page }) => {
  await page.goto("/casadesucosmix");
  await page.getByRole("button", { name: /pedir agora/i }).click();
  await page.getByRole("button", { name: /delivery/i }).click();
  await page.getByRole("button", { name: /ver produtos/i }).click();
  await page.getByRole("button", { name: /suco natural/i }).click();
  await page.getByRole("button", { name: "Entrega", exact: true }).click();
  await page.getByRole("button", { name: /enviar pedido/i }).click();
  await expect(page.getByText(/pedido enviado com sucesso/i)).toBeVisible();
});

test("clínica consulta agenda e confirma horário", async ({ page }) => {
  await page.goto("/clinica-aurora");
  const scheduleStart = page.getByRole("button", { name: /ver agenda/i });
  if (await scheduleStart.isVisible()) await scheduleStart.click();
  await page.getByRole("button", { name: /consulta de nutrição/i }).click();
  await page.getByRole("button", { name: /equipe aurora/i }).click();
  const nextWeekday = await page.evaluate(() => { const date = new Date(); do { date.setDate(date.getDate() + 1); } while ([0, 6].includes(date.getDay())); return date.toISOString().slice(0, 10); });
  await page.getByLabel("Data do agendamento").fill(nextWeekday);
  await page.getByRole("button", { name: /consultar horários/i }).click();
  const slot = page.locator("button").filter({ hasText: /^\d{2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible({ timeout: 30_000 });
  await slot.click();
  await page.getByLabel("Nome").fill("Cliente Clínica");
  await page.getByLabel("WhatsApp").fill("11999990002");
  await page.getByRole("button", { name: /confirmar agendamento/i }).click();
  await expect(page.getByText(/agendamento confirmado/i)).toBeVisible();
});

test("chalé consulta período e solicita reserva", async ({ page }) => {
  await page.goto("/chales-serra-clara");
  const reservationStart = page.getByRole("button", { name: /consultar datas/i });
  if (await reservationStart.isVisible()) await reservationStart.click();
  const dates = await page.evaluate(() => { const start = new Date(); start.setDate(start.getDate() + 7); const end = new Date(start); end.setDate(end.getDate() + 2); return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]; });
  await page.getByLabel("Data de entrada").fill(dates[0]);
  await page.getByLabel("Data de saída").fill(dates[1]);
  await page.getByRole("button", { name: /consultar disponibilidade/i }).click();
  await page.getByRole("button", { name: /chalé vista/i }).click();
  await page.getByLabel("Nome").fill("Cliente Chalé");
  await page.getByLabel("WhatsApp").fill("11999990003");
  await page.getByRole("button", { name: /solicitar reserva/i }).click();
  await expect(page.getByText(/solicitação de reserva enviada/i)).toBeVisible();
});

test("multiunidade pede consentimento e resolve por CEP com fallback manual", async ({ page }) => {
  await page.route("**/api/public/routing/nearest", async (route) => {
    const body = route.request().postDataJSON() as { postalCode?: string };
    expect(body.postalCode).toBe("01310-100");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        data: {
          recommended: {
            id: "unit-sul",
            name: "Unidade Zona Sul",
            address: "Av. Paulista, São Paulo - SP",
            distanceKm: 2.4,
            isOpen: true,
            destination: {
              id: "60000000-0000-4000-8000-000000000601",
              key: "sul",
              type: "whatsapp",
              label: "Unidade Zona Sul",
              value: "5511944444401",
            },
          },
          alternatives: [],
          method: "postal_code",
        },
      }),
    });
  });
  await page.goto("/rede-movimento");
  const routingStart = page.getByRole("button", { name: /encontrar unidade/i });
  if (await routingStart.isVisible()) await routingStart.click();
  await expect(page.getByText(/usaremos sua localização apenas/i)).toBeVisible();
  await page.getByRole("button", { name: /informar cep/i }).click();
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("button", { name: /buscar pelo cep/i }).click();
  await expect(page.getByText("Unidade Zona Sul").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /continuar no whatsapp/i })).toHaveAttribute("href", /wa\.me\/5511944444401/);
});
