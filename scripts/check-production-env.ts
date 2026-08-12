import { productionReadinessIssues } from "../src/lib/env/production-readiness.ts";

const issues = productionReadinessIssues(process.env);

if (issues.length) {
  console.error("Configuração de produção incompleta:");
  for (const issue of issues) console.error(`- ${issue.variable}: ${issue.message}`);
  process.exitCode = 1;
} else {
  console.log("Configuração de produção validada sem expor segredos.");
}
