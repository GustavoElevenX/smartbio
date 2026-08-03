import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }, { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname 127.0.0.1`,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: "true", NEXT_PUBLIC_FEATURE_RESERVATIONS: "true" },
  },
});
