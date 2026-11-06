import { expect, test } from "@playwright/test";

test("workspace salva dados e permite criar e cancelar convites", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/app/settings/workspace");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  const suffix = testInfo.project.name === "mobile-chrome" ? "Mobile" : "Desktop";
  const workspaceName = `Equipe Sobe ${suffix}`;
  const workspaceSlug = `equipe-sobe-${suffix.toLowerCase()}`;
  const name = page.getByLabel("Nome", { exact: true });
  const slug = page.getByLabel("Identificador", { exact: true });
  await expect(name).toBeVisible({ timeout: 20_000 });
  await name.fill(workspaceName);
  await slug.fill(workspaceSlug);
  await page.getByRole("button", { name: "Salvar espaço de trabalho" }).click();
  await expect(page.getByText("Espaço de trabalho atualizado com sucesso.")).toBeVisible();

  await page.reload();
  await expect(name).toHaveValue(workspaceName);
  await expect(slug).toHaveValue(workspaceSlug);

  const email = `convite-${suffix.toLowerCase()}@sobe.test`;
  await page.getByLabel("E-mail para convite").fill(email);
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByText("Convite criado. Copie o endereço abaixo para compartilhar.")).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByLabel(`Endereço de convite para ${email}`)).toHaveValue(/\/invite\//);
  await page.getByRole("button", { name: `Copiar endereço para ${email}` }).click();
  await expect(page.getByText(`Endereço de convite para ${email} copiado.`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("/invite/");

  await page.getByLabel("E-mail para convite").fill(email);
  await page.getByRole("button", { name: "Convidar" }).click();
  await expect(page.getByText("Já existe um convite pendente para este e-mail.")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Cancelar convite para ${email}` }).click();
  await expect(page.getByText(`Convite para ${email} cancelado.`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(email, { exact: true })).toBeHidden();

  if (testInfo.project.name === "desktop-chrome") {
    const acceptedEmail = `membro-${Date.now()}@sobe.test`;
    await page.getByLabel("E-mail para convite").fill(acceptedEmail);
    await page.getByRole("button", { name: "Convidar" }).click();
    const acceptanceUrl = await page.getByLabel(`Endereço de convite para ${acceptedEmail}`).inputValue();
    await page.goto(acceptanceUrl, { waitUntil: "networkidle" });
    const acceptButton = page.getByRole("button", { name: "Aceitar convite" });
    await expect(acceptButton).toBeEnabled({ timeout: 20_000 });
    await acceptButton.click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
    await page.goto("/app/settings/workspace");
    await expect(page.getByText(`${acceptedEmail} · Membro`, { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Remover ${acceptedEmail.split("@")[0]}` }).click();
    await expect(page.getByText(`${acceptedEmail} · Membro`, { exact: true })).toBeHidden();
  }
});
