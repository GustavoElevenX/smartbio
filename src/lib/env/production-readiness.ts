export type ProductionReadinessIssue = {
  variable: string;
  message: string;
};

const requiredVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RATE_LIMIT_SECRET",
  "CRON_SECRET",
  "CUSTOMER_IDENTITY_HASH_SECRET",
] as const;

const secretVariables = [
  "RATE_LIMIT_SECRET",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
  "CUSTOMER_IDENTITY_HASH_SECRET",
] as const;

function value(source: NodeJS.ProcessEnv, name: string) {
  return source[name]?.trim() || "";
}

function enabled(source: NodeJS.ProcessEnv, name: string) {
  return value(source, name) === "true";
}

function requireVariable(issues: ProductionReadinessIssue[], source: NodeJS.ProcessEnv, variable: string) {
  if (!value(source, variable)) issues.push({ variable, message: "variável obrigatória ausente" });
}

function requireHttps(issues: ProductionReadinessIssue[], source: NodeJS.ProcessEnv, variable: string) {
  const configured = value(source, variable);
  if (!configured) return;
  try {
    if (new URL(configured).protocol !== "https:") issues.push({ variable, message: "deve usar HTTPS em produção" });
  } catch {
    issues.push({ variable, message: "URL inválida" });
  }
}

export function productionReadinessIssues(source: NodeJS.ProcessEnv = process.env): ProductionReadinessIssue[] {
  const issues: ProductionReadinessIssue[] = [];

  for (const variable of requiredVariables) requireVariable(issues, source, variable);

  if (enabled(source, "NEXT_PUBLIC_FEATURE_AI")) {
    for (const variable of ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_VISION_MODEL"])
      requireVariable(issues, source, variable);
  }

  if (enabled(source, "NEXT_PUBLIC_FEATURE_NOTIFICATIONS") && value(source, "EMAIL_PROVIDER") !== "console") {
    for (const variable of ["RESEND_API_KEY", "EMAIL_FROM"])
      requireVariable(issues, source, variable);
  }

  if (enabled(source, "NEXT_PUBLIC_FEATURE_GEO_ROUTING")) {
    for (const variable of ["GOOGLE_MAPS_SERVER_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY"])
      requireVariable(issues, source, variable);
  }

  if (enabled(source, "ENABLE_LOCAL_DEV_AUTH"))
    issues.push({ variable: "ENABLE_LOCAL_DEV_AUTH", message: "autenticação local deve estar desativada" });
  if (enabled(source, "NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE"))
    issues.push({ variable: "NEXT_PUBLIC_ENABLE_LOCAL_DEV_STORE", message: "store local deve estar desativado" });

  const hasConfiguredAppUrl = Boolean(
    value(source, "NEXT_PUBLIC_APP_URL") ||
      value(source, "NEXT_PUBLIC_PUBLIC_BASE_URL"),
  );
  const hasVercelUrl = Boolean(
    value(source, "VERCEL_PROJECT_PRODUCTION_URL") || value(source, "VERCEL_URL"),
  );
  if (!hasConfiguredAppUrl && !hasVercelUrl)
    issues.push({
      variable: "NEXT_PUBLIC_APP_URL",
      message: "informe a URL pública ou exponha as variáveis de sistema da Vercel",
    });
  requireHttps(issues, source, "NEXT_PUBLIC_APP_URL");
  requireHttps(issues, source, "NEXT_PUBLIC_PUBLIC_BASE_URL");
  requireHttps(issues, source, "NEXT_PUBLIC_SUPABASE_URL");
  requireHttps(issues, source, "UPSTASH_REDIS_REST_URL");

  const upstashUrl = value(source, "UPSTASH_REDIS_REST_URL");
  const upstashToken = value(source, "UPSTASH_REDIS_REST_TOKEN");
  if (Boolean(upstashUrl) !== Boolean(upstashToken))
    issues.push({
      variable: upstashUrl
        ? "UPSTASH_REDIS_REST_TOKEN"
        : "UPSTASH_REDIS_REST_URL",
      message: "configure URL e token juntos ou deixe ambos ausentes",
    });

  for (const variable of secretVariables) {
    const configured = value(source, variable);
    if (configured && configured.length < 32)
      issues.push({ variable, message: "deve ter pelo menos 32 caracteres aleatórios" });
  }

  const configuredSecrets = secretVariables
    .map((variable) => ({ variable, configured: value(source, variable) }))
    .filter((item) => item.configured);
  for (let index = 0; index < configuredSecrets.length; index += 1) {
    if (configuredSecrets.slice(0, index).some((item) => item.configured === configuredSecrets[index].configured))
      issues.push({ variable: configuredSecrets[index].variable, message: "deve ser diferente dos outros segredos" });
  }

  if (value(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY") && value(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY") === value(source, "SUPABASE_SERVICE_ROLE_KEY"))
    issues.push({ variable: "SUPABASE_SERVICE_ROLE_KEY", message: "não pode ser igual à chave pública do Supabase" });

  return issues;
}
