import { expect, test } from "@playwright/test";

const now = "2026-09-24T15:00:00.000Z";
const seeded = [
  { id: "10000000-0000-4000-8000-000000000001", workspaceId: "workspace", projectId: "demo-casa-sucos", type: "project.published", title: "Sua página está no ar", body: "Casa Mix já está disponível para visitantes.", actionUrl: "/app/projects/demo-casa-sucos/site", metadata: {}, createdAt: now },
  { id: "10000000-0000-4000-8000-000000000002", workspaceId: "workspace", projectId: "demo-casa-sucos", type: "traffic.milestone_reached", title: "Sua página está recebendo visitas", body: "Sua página já recebeu 100 visitas.", actionUrl: "/app/projects/demo-casa-sucos/analytics", metadata: { count: 100 }, createdAt: now },
  { id: "10000000-0000-4000-8000-000000000003", workspaceId: "workspace", projectId: "demo-casa-sucos", type: "lead.created", title: "Novo lead", body: "Uma pessoa concluiu a jornada. Contato: Ana.", actionUrl: "/app/projects/demo-casa-sucos/opportunities", metadata: { visitorName: "Ana" }, createdAt: now },
  { id: "10000000-0000-4000-8000-000000000004", workspaceId: "workspace", type: "subscription.ending", title: "Seu plano está perto do fim", body: "A renovação automática está desativada.", actionUrl: "/app/settings/billing", metadata: {}, createdAt: now },
];

test("sino apresenta e marca notificações básicas", async ({ page }) => {
  let items = seeded.map((item) => ({ ...item }));
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/notifications*", async (route) => {
    if (route.request().method() === "PATCH") {
      const input = route.request().postDataJSON() as { ids?: string[]; all?: boolean };
      items = items.map((item) => input.all || input.ids?.includes(item.id) ? { ...item, readAt: now } : item);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { updated: true } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: items, unread: items.filter((item) => !("readAt" in item)).length }) });
  });

  await page.goto("/app/settings/billing");
  const bell = page.getByRole("button", { name: /Notificações, 4 não lidas/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByText("4 novas")).toBeVisible();
  await expect(page.getByText("Sua página está no ar")).toBeVisible();
  await expect(page.getByText("Sua página está recebendo visitas")).toBeVisible();
  await expect(page.getByText("Novo lead")).toBeVisible();
  await expect(page.getByText("Seu plano está perto do fim")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver resultados" })).toHaveAttribute("href", "/app/projects/demo-casa-sucos/analytics");
  await expect(page.getByRole("link", { name: "Ver plano" })).toHaveAttribute("href", "/app/settings/billing");

  await page.getByRole("button", { name: "Marcar “Sua página está no ar” como lida" }).click();
  await expect(page.getByRole("button", { name: /Notificações, 3 não lidas/ })).toBeVisible();
  await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(page.getByRole("button", { name: "Notificações", exact: true })).toBeVisible();
  await expect(page.getByText("Tudo em dia")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
