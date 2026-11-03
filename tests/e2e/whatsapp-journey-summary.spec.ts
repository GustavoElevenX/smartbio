import { expect, test } from "@playwright/test";
import path from "node:path";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

test("abre o WhatsApp com o resumo organizado da jornada", async ({ page, context }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await context.route("https://wa.me/**", async (route) => {
    const message = new URL(route.request().url()).searchParams.get("text") || "";
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="pt-BR"><head><title>Resumo enviado ao WhatsApp</title><style>body{margin:0;background:#efeae2;font:16px/1.5 Arial,sans-serif;color:#111b21}.shell{max-width:720px;margin:40px auto;padding:20px}.bubble{white-space:pre-wrap;background:#d9fdd3;border-radius:12px;padding:18px 20px;box-shadow:0 2px 8px #0002}</style></head><body><main class="shell"><h1>Mensagem pronta para o WhatsApp</h1><div class="bubble">${escapeHtml(message)}</div></main></body></html>`,
    });
  });

  await page.goto("/casadesucosmix");
  await expect(page).toHaveTitle(/Casa de Sucos Mix/);
  await expect(page.locator("[data-nextjs-dialog-overlay]")).toHaveCount(0);
  await page.getByRole("button", { name: /comprar para revenda/i }).click();
  await page.getByLabel("Seu negócio é").selectOption("Evento");
  await page.getByRole("radio", { name: "31–100 unidades" }).check();
  await page.getByRole("radio", { name: "WhatsApp", exact: true }).check();
  await page.getByRole("button", { name: /ver sugestão/i }).click();
  await expect(page.getByText("Mix Empresas", { exact: true })).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: /falar com atendimento comercial/i }).click();
  const whatsapp = await popupPromise;
  await whatsapp.waitForLoadState("domcontentloaded");
  const message = await whatsapp.locator(".bubble").innerText();

  expect(message).toContain("*Resumo da jornada*");
  expect(message).toContain("Interesse: Sua operação combina com nosso atendimento empresarial.");
  expect(message).toContain("*Informações compartilhadas*");
  expect(message).toContain("• Seu negócio é: Evento");
  expect(message).toContain("• Volume estimado: 31–100 unidades");
  expect(message).toContain("• Como prefere continuar: WhatsApp");
  expect(message).toMatch(/• O que você deseja fazer hoje\? Comprar para revenda/i);
  expect(message).toContain("• Orientação recebida: Mix Empresas foi indicada como possível caminho, sujeito à confirmação da equipe.");
  expect(message).not.toContain("Ver sugestão");

  const screenshotDir = process.env.QA_SCREENSHOT_DIR;
  if (screenshotDir) await whatsapp.screenshot({ path: path.join(screenshotDir, `whatsapp-journey-summary-${testInfo.project.name}.png`), fullPage: true });
  expect(browserErrors).toEqual([]);
});
