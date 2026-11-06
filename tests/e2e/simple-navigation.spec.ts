import { expect, test } from "@playwright/test";
import { findDemoProject } from "../../src/data/demo-projects";

test("navegação simples oferece início, prévia e configurações", async ({ page, request }, testInfo) => {
  test.setTimeout(60_000);
  const project = structuredClone(findDemoProject("demo-casa-sucos")!);
  await request.put(`/api/projects/${project.id}`, { data: project });
  const base = `/app/projects/${project.id}`;

  await page.goto(base);
  await expect(page.getByRole("heading", { name: "Início", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Testar minha SOBE" })).toHaveAttribute("href", new RegExp("/preview$"));
  await expect(page.locator("main .animate-enter")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("inicio.png") });

  await page.goto(`${base}/minha-sobe`);
  await expect(page.getByRole("heading", { name: "Minha SOBE" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Trocar logotipo e cores/ })).toBeVisible();
  await expect(page.getByText("Prévia como visitante · ambiente de teste")).toBeVisible();
  await expect(page.getByText("Prévia indisponível")).toHaveCount(0);
  await expect(page.locator("main .animate-enter")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("minha-sobe.png") });

  await page.goto(`${base}/settings`);
  await expect(page.getByRole("button", { name: "Simples" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  for (const title of ["Meu negócio", "Como atender", "O que perguntar", "Aparência"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.locator("main .animate-enter")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: testInfo.outputPath("configuracoes-simples.png"), fullPage: true });

  await request.put(`/api/projects/${project.id}`, { data: project });
});
