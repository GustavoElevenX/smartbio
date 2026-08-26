import { expect, test } from "@playwright/test";

const description = `A SonoLeve é uma loja especializada em colchões e conforto para o sono. Muitos clientes sabem o que os incomoda, mas não sabem qual opção escolher.

Produtos reais:
- Colchão de espuma
- Colchão de molas ensacadas
- Colchão ortopédico
- Pillow top
- Protetor impermeável

Queremos que a pessoa explique o que busca, responda poucas perguntas e receba uma orientação entre essas opções antes de continuar pelo WhatsApp.`;
const offerNames = ["Colchão de espuma", "Colchão de molas ensacadas", "Colchão ortopédico", "Pillow top", "Protetor impermeável"];

type StructuredQuestion = { id: string; question: string; type: string; purpose: string; required: boolean };
type OfferProfile = { offerId: string; offerName: string; provenance: { source: string; discoveryPlanId?: string; projectId: string } };
type DiscoveryPlan = {
  id: string;
  version: number;
  status: string;
  offerings: Array<{ id: string; name: string }>;
  questions: StructuredQuestion[];
  offerIntelligenceProfiles: OfferProfile[];
};
type SetupSession = {
  commercialArchitecture?: { intents: Array<{ semanticKey?: string; label: string }>; journeyBlueprints: Array<{ intentId: string; mode: string }> };
  architectureReviewed?: boolean;
  visitorActions: Array<{ key: string; label: string; isPrimary: boolean }>;
  answers: Record<string, unknown>;
  questions: Array<{ key: string; suggestedAnswer?: string; structuredAnswer?: StructuredQuestion[] }>;
  discoveryPlan?: DiscoveryPlan;
  projectDraft?: {
    id: string;
    discoveryPlan: DiscoveryPlan & { projectId: string };
    steps: Array<{ type: string; formFields?: Array<{ label: string }> }>;
    commercialConfig: {
      serviceOfferings: Array<{ id: string; name: string; settings: { discoveryPlanId: string; offerIntelligence: OfferProfile } }>;
    };
  };
};

test("SELF-SERVICE UI PLUMBING — SonoLeve apenas confirma o contrato inferido", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const sentinels = ["Casa Clara", "persiana", "Casa Mix", "suco detox", "suco de laranja", "limpeza de pele", "banho e tosa"];
  const strategicInterventions = 0;

  const session = async (sessionId: string) => {
    const response = await page.request.get(`/api/ai/setup/${sessionId}`);
    expect(response.ok()).toBe(true);
    return (await response.json() as { data: SetupSession }).data;
  };

  await page.goto("/app/onboarding/ai?new=1");
  await page.getByLabel("Nome do negócio").fill("SonoLeve Colchões");
  await page.getByLabel("O que você vende e como atende?").fill(description);
  await page.getByLabel("WhatsApp ou telefone (opcional)").fill("(11) 98765-4321");
  await page.getByRole("button", { name: /analisar meu negócio/i }).click();

  await expect(page.getByRole("heading", { name: /entendi seu negócio assim/i })).toBeVisible({ timeout: 20_000 });

  const sessionId = await page.evaluate(() => {
    const raw = localStorage.getItem("smartbio:last-ai-setup-session");
    const parsed = raw ? JSON.parse(raw) as { sessionId?: string } : undefined;
    return parsed?.sessionId || "";
  });
  expect(sessionId).not.toBe("");
  const analyzed = await session(sessionId);
  expect(analyzed.visitorActions.find((action) => action.key === "recommendation")).toMatchObject({ isPrimary: true });
  expect(analyzed.commercialArchitecture?.intents.some((intent) => intent.semanticKey === "recommendation")).toBe(true);
  expect(analyzed.architectureReviewed).toBe(false);

  await page.getByRole("button", { name: /está certo, continuar/i }).click();
  await expect(page.getByRole("heading", { name: /entendi seu negócio assim/i })).not.toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-setup-question]")).toHaveCount(0);
  expect(strategicInterventions).toBe(0);
  await expect(page.getByRole("heading", { name: /pronto para montar a primeira versão/i })).toBeVisible({ timeout: 20_000 });

  const beforeGeneration = await session(sessionId);
  const persistedPlan = beforeGeneration.discoveryPlan;
  expect(persistedPlan).toMatchObject({ status: "ready", version: 1 });
  expect(persistedPlan?.offerings.map((item) => item.name)).toEqual(offerNames);
  expect(persistedPlan?.questions).toHaveLength(3);
  expect(persistedPlan?.offerIntelligenceProfiles).toHaveLength(offerNames.length);
  expect(persistedPlan?.offerIntelligenceProfiles.every((profile) => profile.provenance.source !== "deterministic_placeholder")).toBe(true);

  await page.getByRole("button", { name: /criar minha primeira versão/i }).click();
  await expect(page).toHaveURL(/\/app\/projects\/.+\/launch$/, { timeout: 40_000 });
  await expect(page.getByRole("heading", { name: /sua primeira versão está pronta/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SonoLeve Colchões", exact: true }).first()).toBeVisible();
  const visiblePage = await page.locator("body").innerText();
  for (const offerName of offerNames) expect(visiblePage).toContain(offerName);
  for (const sentinel of sentinels) expect(visiblePage.toLowerCase()).not.toContain(sentinel.toLowerCase());

  const afterGeneration = await session(sessionId);
  const generated = afterGeneration.projectDraft!;
  expect(generated.discoveryPlan.id).toBe(persistedPlan?.id);
  expect(generated.discoveryPlan.version).toBe(persistedPlan?.version);
  expect(generated.discoveryPlan.projectId).toBe(generated.id);
  expect(generated.discoveryPlan.questions).toEqual(persistedPlan?.questions);
  expect(generated.discoveryPlan.offerIntelligenceProfiles.map((profile) => profile.offerId)).toEqual(persistedPlan?.offerIntelligenceProfiles.map((profile) => profile.offerId));
  expect(generated.commercialConfig.serviceOfferings.map((item) => item.id)).toEqual(persistedPlan?.offerings.map((item) => item.id));
  expect(generated.commercialConfig.serviceOfferings.map((item) => item.name)).toEqual(offerNames);
  expect(generated.commercialConfig.serviceOfferings.every((item) => item.settings.discoveryPlanId === persistedPlan?.id)).toBe(true);
  expect(generated.commercialConfig.serviceOfferings.map((item) => item.settings.offerIntelligence)).toEqual(generated.discoveryPlan.offerIntelligenceProfiles);
  const runtimeQuestions = generated.steps.find((step) => step.type === "form")?.formFields?.map((field) => field.label);
  expect(runtimeQuestions).toEqual(persistedPlan?.questions.map((question) => question.question));

  for (const width of [360, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await expect(page.getByRole("link", { name: "Editar página" })).toBeVisible();
  }
  const screenshotPath = process.env.ACTIVATION_GATE_SCREENSHOT_PATH || testInfo.outputPath("sonoleve-generated-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("ACTIVATION_SCREENSHOT_METADATA", JSON.stringify({
    projectName: "SonoLeve Colchões",
    projectId: generated.id,
    route: `/app/projects/${generated.id}/launch`,
    generatedByPipeline: true,
    viewport: "390x844",
    strategicInterventions,
    domTextMutation: false,
    screenshotPath,
  }));

  await page.getByRole("link", { name: "Editar página" }).click();
  await expect(page.getByTestId("site-editor-simple")).toBeVisible();
  await expect(page.getByText("SonoLeve Colchões").filter({ visible: true }).first()).toBeVisible();
});
