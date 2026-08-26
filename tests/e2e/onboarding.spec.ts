import { expect, test } from "@playwright/test";

test("onboarding adaptativo funciona sem login e gera um rascunho", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/app/onboarding/ai?new=1");
  await expect(page).toHaveURL(/\/app\/onboarding\/ai(?:\?new=1)?$/);
  await expect(page.getByRole("heading", { name: /vamos montar a sua sobe/i })).toBeVisible();

  await page.getByLabel("Nome do negócio").fill("Clínica Aurora");
  await page.getByLabel("O que você vende e como atende?").fill("Clínica de estética com limpeza de pele, tratamentos faciais e corporais. Quero ajudar o visitante a entender qual caminho pode fazer sentido e solicitar uma avaliação profissional pelo WhatsApp.");
  await page.getByLabel("WhatsApp ou telefone (opcional)").fill("(11) 98765-4321");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Recomendamos de 2 a 5 ações")).toBeVisible();
  await page.getByRole("button", { name: /editar informações do negócio/i }).click();
  await expect(page.getByLabel("O que você vende e como atende?")).toBeEnabled();
  await page.getByLabel("O que você vende e como atende?").fill("Clínica de estética com tratamentos faciais e corporais. Quero orientar possibilidades sem diagnosticar e encaminhar o visitante para uma avaliação profissional pelo WhatsApp.");
  await page.getByRole("button", { name: /analisar novamente/i }).click();
  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Roteamento", { exact: true })).toHaveCount(0);
  const removeScheduling = page.getByRole("button", { name: "Remover Agendar", exact: true });
  if (await removeScheduling.count()) await removeScheduling.click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("button", { name: /criar minha primeira versão/i })).toHaveCount(0);
  for (let index = 0; index < 8; index += 1) {
    if (await page.getByRole("heading", { name: /pronto para montar a primeira versão/i }).isVisible().catch(() => false)) break;
    const offerings = page.locator("[data-setup-question]").filter({ hasText: /Encontramos estas opções|Encontramos estes serviços|Quais opções a Sobe pode recomendar\?/i });
    if (await offerings.isVisible().catch(() => false)) {
      await offerings.getByPlaceholder("Digite sua resposta…").fill("Limpeza de pele; Tratamento facial; Tratamento corporal");
      await offerings.getByRole("button", { name: /salvar resposta/i }).click();
    } else {
      const suggestion = page.getByRole("button", { name: /usar assim/i }).first();
      await expect(suggestion).toBeVisible();
      await suggestion.click();
    }
    await expect(page.getByText(/salvo\. a sobe atualizou|salvo\. esta confirmação/i)).toBeVisible();
    await page.waitForTimeout(600);
  }
  await expect(page.getByRole("heading", { name: /pronto para montar a primeira versão/i })).toBeVisible();
  await page.getByRole("button", { name: /criar minha primeira versão/i }).click();

  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /sua primeira versão está pronta/i })).toBeVisible();
  await expect(page.getByText(/pronto para publicar:/i)).toBeVisible();
  await page.getByRole("link", { name: "Editar página" }).click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
});

test("sessão órfã entra em recuperação e nunca dispara analyze com id inválido", async ({ page }) => {
  const analyzeRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/ai\/setup\/[^/]+\/analyze$/.test(request.url()))
      analyzeRequests.push(request.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("smartbio:last-ai-setup-session", JSON.stringify({
      id: "00000000-0000-4000-8000-000000000099",
      workspaceId: "local-workspace",
      initialInput: {
        businessName: "Negócio antigo",
        description: "Informações de um rascunho antigo que não existe mais.",
        phone: "11911111111",
      },
    }));
  });

  await page.goto("/app/onboarding/ai");
  await expect(page.getByRole("heading", { name: /não conseguimos continuar este rascunho/i })).toBeVisible();
  expect(analyzeRequests).toHaveLength(0);

  await page.getByRole("button", { name: /começar novamente/i }).click();
  const name = page.getByLabel("Nome do negócio");
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue("");
  await name.fill("Studio Nexo Interiores");
  await page.getByLabel("O que você vende e como atende?").fill("Escritório de arquitetura e interiores que orienta o visitante para o serviço adequado e depois encaminha para conversar com a equipe.");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();
  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  expect(analyzeRequests).toHaveLength(1);
  expect(analyzeRequests[0]).not.toContain("00000000-0000-4000-8000-000000000099");
});

test("refresh retoma a sessão válida e confirma somente o WhatsApp persistido", async ({ page }) => {
  await page.goto("/app/onboarding/ai?new=1");
  const name = page.getByLabel("Nome do negócio");
  const description = page.getByLabel("O que você vende e como atende?");
  const phone = page.getByLabel("WhatsApp ou telefone (opcional)");
  await name.fill("Studio Nexo Interiores");
  await description.fill("Escritório de arquitetura e interiores que orienta clientes e continua o atendimento pelo WhatsApp.");
  await phone.fill("(11) 98765-4321");
  const sessionId = await page.evaluate(() => {
    const raw = localStorage.getItem("smartbio:last-ai-setup-session");
    if (!raw) return "";
    const value = JSON.parse(raw) as { sessionId?: unknown };
    return typeof value.sessionId === "string" ? value.sessionId : "";
  });
  expect(sessionId).not.toBe("");
  await expect.poll(async () => {
    const response = await page.request.get(`/api/ai/setup/${sessionId}`);
    if (!response.ok()) return null;
    const payload = await response.json() as {
      data?: { initialInput?: { businessName?: string; description?: string; phone?: string } };
    };
    return payload.data?.initialInput || null;
  }, { timeout: 15_000 }).toMatchObject({
    businessName: "Studio Nexo Interiores",
    description: "Escritório de arquitetura e interiores que orienta clientes e continua o atendimento pelo WhatsApp.",
    phone: "(11) 98765-4321",
  });
  await expect(page.getByText(/whatsapp salvo e confirmado/i)).toHaveCount(0);

  await page.reload();
  await expect(name).toHaveValue("Studio Nexo Interiores");
  await expect(description).toHaveValue(/Escritório de arquitetura/);
  await expect(phone).toHaveValue("(11) 98765-4321");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();
  await expect(page.getByText(/whatsapp salvo e confirmado/i)).toBeVisible({ timeout: 15_000 });
  await expect(phone).toHaveValue("+5511987654321");
});

test("começar novamente cria outra sessão sem misturar o negócio anterior", async ({ page }) => {
  await page.goto("/app/onboarding/ai?new=1");
  const name = page.getByLabel("Nome do negócio");
  const description = page.getByLabel("O que você vende e como atende?");
  await name.fill("Negócio A");
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PATCH" && response.ok(),
  );
  await description.fill("Configuração relevante do primeiro negócio para testar a retomada.");
  await saved;
  await page.reload();
  await expect(page.getByText("Configuração em andamento")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /começar novamente/i }).click();
  await expect(name).toBeEnabled();
  await expect(name).toHaveValue("");
  await expect(description).toHaveValue("");
  await name.fill("Negócio B");
  await expect(name).toHaveValue("Negócio B");
});

test("WhatsApp inválido permanece visível e mostra como corrigir", async ({ page }) => {
  await page.goto("/app/onboarding/ai?new=1");
  await page.getByLabel("Nome do negócio").fill("Studio Norte");
  await page.getByLabel("O que você vende e como atende?").fill("Studio de serviços que orienta clientes e continua o atendimento pelo WhatsApp.");
  const phone = page.getByLabel("WhatsApp ou telefone (opcional)");
  await phone.fill("123");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.locator("#ai-phone-error")).toContainText("Confira o número. Use DDD + telefone.");
  await expect(phone).toHaveValue("123");
  await expect(phone).toBeEnabled();

  await phone.fill("5511000000000");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();
  await expect(page.getByRole("heading", { name: /o que você quer que essa pessoa consiga fazer/i })).toBeVisible({ timeout: 15_000 });
  await expect(phone).toHaveValue("+5511000000000");
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
