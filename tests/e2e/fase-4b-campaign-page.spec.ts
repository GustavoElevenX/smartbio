import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const projectId = "demo-activation";
const slug = "virou-activation-demo";
const cleanupIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const activationId of cleanupIds.splice(0)) {
    await request.post(`/api/projects/${projectId}/activations/${activationId}/end`);
  }
});

async function navigate(page: Page, url: string) {
  try { await page.goto(url, { waitUntil: "domcontentloaded" }); }
  catch (error) {
    if (!(error instanceof Error) || !error.message.includes("ERR_ABORTED")) throw error;
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
}

async function createCampaign(request: APIRequestContext, label: string, mode: "exclusive" | "exclusive_and_home", priority: number) {
  const key = `fase-4b-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const response = await request.post(`/api/projects/${projectId}/activations`, { data: {
    name: label, activationKey: key, activationType: "promotion", title: label,
    message: "Converse com a Casa Mix sobre esta campanha.", conversionGoalId: "mix-goal-resale",
    destinationMode: "native", completionChannel: "native", priority,
    requiresIdentity: false, identityMode: "none", eligibility: {}, offers: [], placements: [],
    settings: { dynamicSurface: { mode, experienceKey: key, title: label,
      message: "Converse com a Casa Mix sobre esta campanha.", conversionGoalId: "mix-goal-resale", sections: [
        { key: "hero", kind: "hero", content: { title: label, text: "Uma apresentação publicada pela Casa Mix." } },
        { key: "conditions", kind: "conditions", content: { title: "Condições", text: "Confirme os detalhes com nossa equipe." } },
        { key: "action", kind: "action", content: { title: "Fale com a equipe", ctaLabel: "Quero conversar" } },
      ] } },
  } });
  expect(response.status()).toBe(201);
  const created = await response.json() as { data: { activation: { id: string; version: number } } };
  cleanupIds.push(created.data.activation.id);
  return { ...created.data.activation, key, label };
}

async function publish(request: APIRequestContext, item: { id: string; version: number }) {
  const response = await request.post(`/api/projects/${projectId}/activations/${item.id}/publish`, {
    data: { confirmed: true, reviewedVersion: item.version },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

test("página exclusiva, troca da home, prioridade e retorno preservam a jornada", async ({ page, request }) => {
  test.setTimeout(90_000);
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => { if (/hydrat/i.test(error.message)) hydrationErrors.push(error.message); });
  const original = await page.goto(`/${slug}`, { waitUntil: "domcontentloaded" });
  expect(original?.ok()).toBeTruthy();
  await expect(page.getByRole("heading", { name: "O que você deseja fazer hoje?" })).toBeVisible();

  const home = await createCampaign(request, "Campanha principal 4B", "exclusive_and_home", 800);
  const exclusive = await createCampaign(request, "Campanha exclusiva 4B", "exclusive", 900);
  const unconfirmed = await request.post(`/api/projects/${projectId}/activations/${home.id}/publish`);
  expect(unconfirmed.status(), await unconfirmed.text()).toBe(409);
  await publish(request, home);
  await publish(request, exclusive);

  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: home.label })).toBeVisible();
  await expect(page.getByText("Uma apresentação publicada pela Casa Mix.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Condições" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero conversar" })).toBeVisible();
  await page.getByRole("link", { name: "Ver página do negócio" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/${slug}\\?view=standard$`));
  await expect(page.getByRole("heading", { name: "O que você deseja fazer hoje?" })).toBeVisible();
  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: home.label })).toBeVisible();
  await navigate(page, `/${slug}/c/${exclusive.key}`);
  await expect(page.getByRole("heading", { name: exclusive.label })).toBeVisible();
  await navigate(page, `/${slug}?entry=bio`);
  await expect(page.getByRole("heading", { name: "Como deseja receber?" })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  await navigate(page, `/${slug}/p/home`);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: home.label })).toHaveCount(0);

  const changed = await request.patch(`/api/projects/${projectId}/activations/${home.id}`, {
    data: { title: "Rascunho novo, ainda não publicado", priority: 950 },
  });
  expect(changed.ok()).toBeTruthy();
  const changedPayload = await changed.json() as { data?: { activation?: { status: string; publishedSnapshot?: { snapshotVersion: number } } } };
  expect(changedPayload.data?.activation).toMatchObject({ status: "active", publishedSnapshot: { snapshotVersion: 2 } });
  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: home.label })).toBeVisible();

  const paused = await request.post(`/api/projects/${projectId}/activations/${home.id}/pause`);
  expect(paused.ok()).toBeTruthy();
  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: "O que você deseja fazer hoje?" })).toBeVisible();
  const resumed = await request.post(`/api/projects/${projectId}/activations/${home.id}/resume`);
  expect(resumed.ok()).toBeTruthy();
  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: home.label })).toBeVisible();

  const ended = await request.post(`/api/projects/${projectId}/activations/${home.id}/end`);
  expect(ended.ok()).toBeTruthy();
  await navigate(page, `/${slug}`);
  await expect(page.getByRole("heading", { name: "O que você deseja fazer hoje?" })).toBeVisible();
  await navigate(page, `/${slug}/c/${home.key}`);
  await expect(page.getByRole("heading", { name: "Esta campanha não está disponível." })).toBeVisible();
  await navigate(page, `/${slug}/c/${exclusive.key}`);
  await expect(page.getByRole("heading", { name: exclusive.label })).toBeVisible();
});
