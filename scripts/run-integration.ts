import { spawnSync } from "node:child_process";

const required = ["INTEGRATION_TEST_SUPABASE_URL", "INTEGRATION_TEST_SUPABASE_SERVICE_ROLE_KEY", "INTEGRATION_TEST_USER_ID"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`NOT_RUN_ENV_MISSING: ${missing.join(", ")}`);
  process.exit(2);
}
const result = spawnSync(process.execPath, ["./node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts"], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
