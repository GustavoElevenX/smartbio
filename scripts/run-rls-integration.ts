import { spawnSync } from "node:child_process";

const required = [
  "RLS_TEST_ALLOW_REMOTE",
  "RLS_TEST_SUPABASE_URL",
  "RLS_TEST_SUPABASE_ANON_KEY",
  "RLS_TEST_SUPABASE_SERVICE_ROLE_KEY",
];
const missing = required.filter((key) => !process.env[key]);
if (process.env.RLS_TEST_ALLOW_REMOTE !== "true") {
  console.error("NOT_RUN: RLS_TEST_ALLOW_REMOTE=true is required; refusing to run against an unapproved project.");
  process.exit(2);
}
if (missing.length) {
  console.error(`NOT_RUN_ENV_MISSING: ${missing.join(", ")}`);
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "--config", "vitest.integration.config.ts", "tests/integration/rls-multi-tenant.test.ts"],
  { stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
