import { expect, test } from "@playwright/test";
import path from "node:path";
import { findDemoProject } from "../../src/data/demo-projects";

test("modo simples e avançado compartilham o rascunho sem publicar", async ({ page, request }) => {
  const project = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${project.id}`, { data: project });
  await page.goto(`/app/projects/${project.id}/settings`);
  await page.getByRole("button", { name: /Meu negócio/ }).click();

  const draftName = `${project.name} edição`;
  await page.getByLabel("Nome do negócio").fill(draftName);
  await expect(page.getByText("Há alterações não salvas.", { exact: false })).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: /Detalhar produtos/ }).click();
  await expect(page).toHaveURL(new RegExp(`/settings$`));
  await page.getByRole("button", { name: "Avançado" }).click();
  await page.getByText("Administração, versões e ações do projeto").click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(draftName);
  await page.getByRole("button", { name: "Simples" }).click();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue(draftName);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Rascunho salvo; página pública ainda não atualizada/)).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await page.getByRole("button", { name: /Meu negócio/ }).click();
  await expect(page.getByLabel("Nome do negócio")).toHaveValue(draftName);

  await request.put(`/api/projects/${project.id}`, { data: project });
});

test("cadastra vários WhatsApps, valida duplicados e preserva o principal", async ({ page, request }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const project = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${project.id}`, { data: project });
  await page.goto(`/app/projects/${project.id}/settings`);

  await expect(page).toHaveTitle(/Configurações do negócio/);
  await expect(page.getByRole("button", { name: "Simples" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Meu negócio" })).toBeVisible();
  await page.getByRole("button", { name: "Avançado" }).click();
  await page.getByText("Administração, versões e ações do projeto").click();
  await expect(page.getByRole("group", { name: "Números de WhatsApp" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
  await expect(page.locator("#contact").getByText("Principal", { exact: true })).toBeVisible();

  await page.locator("#contact").getByRole("button", { name: "Adicionar número" }).click();
  const names = page.locator("#contact").getByLabel("Nome do atendimento");
  const phones = page.locator("#contact").getByLabel("Número", { exact: true });
  await names.nth(1).fill("Equipe de vendas");
  await phones.nth(1).fill("55 11 99999-1001");
  await expect(page.locator("#contact").getByText("Este número já está cadastrado.")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();

  await phones.nth(1).fill("55 21 98888-0000");
  await page.locator("#contact").getByRole("button", { name: "Tornar principal" }).click();
  await expect(page.locator("#contact").getByText("Este número já está cadastrado.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Alterações salvas", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Avançado" }).click();
  await page.getByText("Administração, versões e ações do projeto").click();
  await expect(page.locator("#contact").getByLabel("Nome do atendimento")).toHaveCount(2);
  await expect(page.locator("#contact").getByLabel("Nome do atendimento").nth(1)).toHaveValue("Equipe de vendas");
  await expect(page.locator("#contact").getByLabel("Número", { exact: true }).nth(1)).toHaveValue("55 21 98888-0000");
  await expect(page.locator("#contact").getByText("Principal", { exact: true })).toBeVisible();

  const screenshotDir = process.env.QA_SCREENSHOT_DIR;
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, `whatsapp-settings-${testInfo.project.name}.png`), fullPage: true });
  }

  await page.goto(`/app/projects/${project.id}/editor`);
  const steps = page.getByRole("complementary", { name: "Etapas da jornada" });
  const panel = page.getByRole("complementary", { name: "Editar etapa" });
  await steps.getByRole("button", { name: /Sua operação combina/ }).click();
  const destination = panel.getByLabel("Número de destino");
  await expect(destination.getByRole("option", { name: "Equipe de vendas · Principal" })).toHaveCount(1);
  await destination.selectOption({ label: "Equipe de vendas · Principal" });
  await expect(destination).not.toHaveValue("");

  expect(browserErrors).toEqual([]);

  await request.put(`/api/projects/${project.id}`, { data: project });
});

test("edita intenção e cor no Simples sem publicar e persiste no celular e desktop", async ({ page, request }, testInfo) => {
  const project = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${project.id}`, { data: project });
  await page.goto(`/app/projects/${project.id}/settings`);
  await page.getByRole("button", { name: /Meu negócio/ }).click();
  const firstGoal = page.getByLabel("Nome da intenção").first();
  await firstGoal.fill("Quero pedir sucos");
  await page.getByRole("button", { name: /Aparência/ }).click();
  await page.getByLabel("Cor principal").fill("#2266aa");
  await expect(page.getByText("Prévia do rascunho · ainda não publicada")).toBeVisible();
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText(/Rascunho salvo; página pública ainda não atualizada/)).toBeVisible({ timeout: 15_000 });
  const saved = await (await request.get(`/api/projects/${project.id}`)).json();
  expect(saved.data.conversionGoals[0].name).toBe("Quero pedir sucos");
  expect(saved.data.designSystem.colors.primary).toBe("#2266aa");
  expect(saved.data.brand.activePalette.primary).toBe("#2266aa");
  expect(saved.data.publishedVersionId).toBe(project.publishedVersionId);
  await page.reload();
  await page.getByRole("button", { name: /Meu negócio/ }).click();
  await expect(page.getByLabel("Nome da intenção").first()).toHaveValue("Quero pedir sucos");
  await page.getByRole("button", { name: /Aparência/ }).click();
  await expect(page.getByLabel("Cor principal")).toHaveValue("#2266aa");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", await page.evaluate(() => document.body.clientWidth));
  await page.screenshot({ path: testInfo.outputPath("simple-settings-edited.png"), fullPage: true });
  await request.put(`/api/projects/${project.id}`, { data: project });
});
