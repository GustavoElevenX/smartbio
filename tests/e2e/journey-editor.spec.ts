import { expect, test } from "@playwright/test";
import { findDemoProject } from "../../src/data/demo-projects";

test("editor acompanha a etapa, rola a prévia e preserva edição ao recarregar", async ({ page, request }, testInfo) => {
  const project = findDemoProject("demo-casa-sucos")!;
  await request.put(`/api/projects/${project.id}`, { data: project });
  await page.goto(`/app/projects/${project.id}/editor`);
  const steps = page.getByRole("complementary", { name: "Etapas da jornada" });
  const panel = page.getByRole("complementary", { name: "Editar etapa" });
  const preview = page.getByRole("region", { name: "Prévia da jornada", exact: true });
  const previewDevice = page.getByTestId("journey-preview-device");
  if (testInfo.project.name === "desktop-chrome") {
    const normalPreviewWidth = await previewDevice.evaluate((element) => element.getBoundingClientRect().width);
    expect(normalPreviewWidth).toBeGreaterThan(430);
    await page.getByRole("button", { name: "Ampliar prévia" }).click();
    await expect(page.getByRole("button", { name: "Sair da prévia ampliada" })).toHaveAttribute("aria-pressed", "true");
    await expect(steps).toBeHidden();
    await expect(panel).toBeHidden();
    await expect.poll(() => previewDevice.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(normalPreviewWidth);
    await page.getByRole("button", { name: "Sair da prévia ampliada" }).click();
    await expect(page.getByRole("button", { name: "Ampliar prévia" })).toHaveAttribute("aria-pressed", "false");
    await expect(steps).toBeVisible();
    await expect(panel).toBeVisible();
  }
  const b2b = project.steps.find((step) => step.id === "mix-b2b-form")!;
  await steps.getByRole("button", { name: new RegExp(b2b.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await expect(preview.getByRole("heading", { name: b2b.title })).toBeVisible();
  await expect(panel.getByText("Campos do formulário", { exact: true })).toBeVisible();
  await panel.getByLabel("Título", { exact: true }).fill("Pedido para minha empresa");
  await expect(preview.getByRole("heading", { name: "Pedido para minha empresa" })).toBeVisible();
  await expect(page.getByText("Salvo", { exact: true })).toBeVisible();
  await page.reload();
  await steps.getByRole("button", { name: /Pedido para minha empresa/ }).click();
  await expect(panel.getByLabel("Título", { exact: true })).toHaveValue("Pedido para minha empresa");
  await page.getByLabel("Visualizar prévia como").selectOption("bio");
  const scroller = page.getByLabel("Conteúdo da prévia, role para ver mais", { exact: true });
  await scroller.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(preview.getByRole("link", { name: "Feito com Sobe" })).toBeVisible();
  const stepWithBlock = project.steps.find((step) => step.blocks?.length);
  expect(stepWithBlock).toBeTruthy();
  await steps.getByRole("button", { name: new RegExp(stepWithBlock!.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  const quickMode = page.getByRole("button", { name: "Rápido", exact: true });
  const advancedMode = page.getByRole("button", { name: "Avançado", exact: true });
  await expect(quickMode).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("Edição rápida", { exact: true })).toBeVisible();
  await advancedMode.click();
  await expect(advancedMode).toHaveAttribute("aria-pressed", "true");
  await expect(quickMode).toHaveAttribute("aria-pressed", "false");
  await expect(panel.getByText("Edição avançada", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("advanced-block-editor")).toBeVisible();
  await expect(panel.getByLabel(/Conteúdo JSON de/).first()).toBeVisible();
  await quickMode.click();
  await expect(quickMode).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText("Edição rápida", { exact: true })).toBeVisible();
  await panel.getByText("Configuração comercial do negócio", { exact: true }).click();
  await panel.getByRole("button", { name: "Configurar Qualificação comercial" }).click();
  await expect(panel.getByText(/A pontuação usa/)).toBeVisible();
  await request.put(`/api/projects/${project.id}`, { data: project });
});

test("publicação permite usar a página selecionada como início do link principal", async ({ page, request }, testInfo) => {
  const original = findDemoProject("demo-casa-sucos")!;
  const project = structuredClone(original);
  const goal = project.conversionGoals?.find((item) => item.isActive && item.isPrimary) || project.conversionGoals?.find((item) => item.isActive);
  expect(goal).toBeTruthy();
  project.capabilities = [];
  project.dataRequirements = [];
  project.commercialConfig = {};
  project.steps[5] = {
    ...project.steps[5],
    description: "Confirme os dados do pedido para falar com a equipe.",
  };
  project.status = "published";
  project.publication = { homeMode: "goal", conversionGoalId: goal!.id };
  await page.addInitScript((seed) => {
    window.localStorage.setItem("smartbio:projects:v3", JSON.stringify([seed]));
  }, project);
  await request.put(`/api/projects/${project.id}`, { data: project });

  await page.goto(`/${project.slug}`);
  const target = project.steps.find((step) => step.id === goal!.targetStepId)!;
  await expect(page.getByRole("heading", { name: target.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: /o que você deseja fazer hoje/i })).toHaveCount(0);

  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/publication-goal-${testInfo.project.name}.png`, fullPage: false });
  }

  await page.goto(`/app/projects/${project.id}/editor`);
  await page.getByRole("button", { name: "Publicar alterações" }).click();
  const dialog = page.getByRole("dialog", { name: "Revisão antes de publicar" });
  await expect(dialog.getByText("O que abre no link principal?")).toBeVisible();
  await dialog.getByText("Ação específica", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /ação específica/i })).toBeChecked();
  await dialog.getByLabel("A experiência começa em").selectOption(goal!.id);
  await expect(dialog.getByLabel("A experiência começa em")).toHaveValue(goal!.id);
  await dialog.getByText("Página selecionada", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /página selecionada/i })).toBeChecked();
  await expect(dialog.getByLabel("A experiência começa em")).toHaveCount(0);
  await expect(dialog.getByLabel("Página que abre primeiro")).toHaveValue(project.steps[0].id);
  await expect(dialog.getByText(/os botões dessa página continuam/i)).toBeVisible();
  await expect(dialog.getByText("Pronto para publicar", { exact: true })).toBeVisible();

  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/publication-step-${testInfo.project.name}.png`, fullPage: false });
  }
  await dialog.getByRole("button", { name: "Publicar alterações" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(`/${project.slug}`);
  await expect(page.getByRole("heading", { name: project.steps[0].title })).toBeVisible();
  if (process.env.E2E_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/publication-step-live-${testInfo.project.name}.png`, fullPage: false });
  }
  await request.put(`/api/projects/${original.id}`, { data: original });
});
