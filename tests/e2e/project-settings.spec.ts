import { expect, test } from "@playwright/test";
import path from "node:path";
import { findDemoProject } from "../../src/data/demo-projects";

test("cadastra vários WhatsApps, valida duplicados e preserva o principal", async ({ page, request }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const project = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${project.id}`, { data: project });
  await page.goto(`/app/projects/${project.id}/settings`);

  await expect(page).toHaveTitle(/Configurações do negócio/);
  await expect(page.getByRole("group", { name: "Números de WhatsApp" })).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar número" }).click();
  const names = page.getByLabel("Nome do atendimento");
  const phones = page.getByLabel("Número", { exact: true });
  await names.nth(1).fill("Equipe de vendas");
  await phones.nth(1).fill("55 11 99999-1001");
  await expect(page.getByText("Este número já está cadastrado.")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeDisabled();

  await phones.nth(1).fill("55 21 98888-0000");
  await page.getByRole("button", { name: "Tornar principal" }).click();
  await expect(page.getByText("Este número já está cadastrado.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Alterações salvas", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome do atendimento")).toHaveCount(2);
  await expect(page.getByLabel("Nome do atendimento").nth(1)).toHaveValue("Equipe de vendas");
  await expect(page.getByLabel("Número", { exact: true }).nth(1)).toHaveValue("55 21 98888-0000");
  await expect(page.getByText("Principal", { exact: true })).toBeVisible();

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
