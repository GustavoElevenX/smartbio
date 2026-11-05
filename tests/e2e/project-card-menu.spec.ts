import { expect, test } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { findDemoProject } from "../../src/data/demo-projects";

test("menu do projeto permite cancelar e confirmar a exclusão", async ({ page }, testInfo) => {
  const sourceProject = structuredClone(findDemoProject("demo-casa-sucos")!);
  const copyProject = {
    ...sourceProject,
    id: randomUUID(),
    name: "Casa de Sucos Mix — cópia",
    slug: `casa-de-sucos-copia-${randomUUID().slice(0, 8)}`,
    status: "draft" as const,
  };
  await page.goto("/app/projects");
  await page.evaluate((project) => {
    localStorage.setItem("smartbio:projects:v3", JSON.stringify([project]));
  }, copyProject);
  await page.reload();

  const original = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Casa de Sucos Mix", exact: true }),
  });
  const copy = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Casa de Sucos Mix — cópia", exact: true }),
  });
  await expect(copy).toBeVisible();
  await copy.getByRole("button", { name: "Mais opções para Casa de Sucos Mix — cópia" }).click();
  await expect(page.locator('a[href^="/app/projects/"][href$="/settings"]')).toBeVisible();
  await page.getByRole("button", { name: "Excluir projeto" }).click();
  await expect(page.getByRole("dialog", { name: "Excluir projeto?" })).toBeVisible();

  const screenshotDir = process.env.QA_SCREENSHOT_DIR;
  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, `project-delete-dialog-${testInfo.project.name}.png`) });
  }

  await page.getByRole("button", { name: "Cancelar" }).click();
  await expect(copy).toBeVisible();
  await copy.getByRole("button", { name: "Mais opções para Casa de Sucos Mix — cópia" }).click();
  await page.getByRole("button", { name: "Excluir projeto" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir projeto" }).click();
  await expect(copy).toHaveCount(0);

  await page.reload();
  await expect(copy).toHaveCount(0);
  await expect(original).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
});
