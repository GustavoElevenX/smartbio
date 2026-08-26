import { defineConfig, devices } from "@playwright/test";

const e2ePort = Number(process.env.E2E_PORT || 3000);
const reuseE2eServer = process.env.E2E_REUSE_SERVER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${e2ePort}`, trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }, { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${e2ePort}`,
    url: `http://127.0.0.1:${e2ePort}`,
    reuseExistingServer: reuseE2eServer,
    timeout: 120_000,
    env: {
      ...process.env,
      ACTIVATION_GATE_FAKE_AI: process.env.ACTIVATION_GATE_FAKE_AI || "true",
      E2E_DISABLE_RATE_LIMITS: "true",
      ENABLE_LOCAL_DEV_AUTH: "true",
      NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE: "true",
      NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: "true",
      NEXT_PUBLIC_FEATURE_RESERVATIONS: "true",
      NEXT_PUBLIC_FEATURE_GEO_ROUTING: "true",
      NEXT_PUBLIC_FEATURE_MULTI_UNIT: "true",
    },
  },
});
