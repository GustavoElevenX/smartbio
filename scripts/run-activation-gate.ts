import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.ACTIVATION_GATE_PORT || 3127);
const baseEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ACTIVATION_GATE_FAKE_AI: "true",
  ENABLE_LOCAL_DEV_AUTH: "true",
  NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE: "true",
  NEXT_PUBLIC_FEATURE_CATALOG_ORDERS: "true",
  NEXT_PUBLIC_FEATURE_RESERVATIONS: "true",
  NEXT_PUBLIC_FEATURE_GEO_ROUTING: "true",
  NEXT_PUBLIC_FEATURE_MULTI_UNIT: "true",
};
const artifactDir = join(tmpdir(), "sobe-activation-gate");
const screenshotPath = join(artifactDir, "casa-clara-generated-mobile-390.png");
mkdirSync(artifactDir, { recursive: true });

async function runLayer(label: string, args: string[], env = baseEnv) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("close", (value) => resolve(value ?? 1));
  });
  if (code !== 0) throw new Error(`${label} falhou com código ${code}.`);
  process.stdout.write(`=== ${label}: PASS ===\n`);
}

async function waitForServer(url: string, child: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`Servidor E2E encerrou com código ${child.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // O servidor ainda está subindo.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Servidor E2E não ficou disponível dentro de 120 segundos.");
}

function stopServer(child: ChildProcess) {
  if (!child.pid || child.exitCode != null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

await runLayer("UNIT ENGINE", ["node_modules/vitest/vitest.mjs", "run", "tests/unit/activation-v6-offer-intelligence.test.ts"]);
await runLayer("CONTRACT", ["node_modules/vitest/vitest.mjs", "run", "tests/unit/discovery-plan-contract.test.ts", "tests/unit/adaptive-question-suggestion.test.ts"]);
await runLayer("PIPELINE INTEGRATION", ["node_modules/vitest/vitest.mjs", "run", "tests/unit/discovery-plan-pipeline-integration.test.ts"]);

process.stdout.write("\n=== SELF-SERVICE ACTIVATION E2E ===\n");
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: baseEnv,
  stdio: "inherit",
  shell: false,
});
try {
  await waitForServer(`http://127.0.0.1:${port}`, server);
  await runLayer("SELF-SERVICE ACTIVATION E2E", ["node_modules/@playwright/test/cli.js", "test", "tests/e2e/self-service-activation.spec.ts", "--project=mobile-chrome"], {
    ...baseEnv,
    E2E_PORT: String(port),
    E2E_REUSE_SERVER: "true",
    ACTIVATION_GATE_SCREENSHOT_PATH: screenshotPath,
  });
} finally {
  stopServer(server);
}

process.stdout.write(`\nActivation gate concluído. Screenshot: ${screenshotPath}\n`);
process.exit(0);
