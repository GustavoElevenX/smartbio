import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, RECOVERY_REDIRECT_PATH, validateNewPassword } from "@/features/auth/password-recovery";
import { safeNextPath } from "@/lib/safe-next";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("recuperação de senha", () => {
  const form = read("src/features/auth/password-recovery-form.tsx");
  const authForm = read("src/features/auth/auth-form.tsx");
  const callback = read("src/app/(auth)/auth/callback/route.ts");
  const page = read("src/app/(auth)/reset-password/page.tsx");

  it("mantém a solicitação de recovery apontando para a tela dedicada", () => {
    expect(authForm).toContain("resetPasswordForEmail");
    expect(authForm).toContain("RECOVERY_REDIRECT_PATH");
    expect(RECOVERY_REDIRECT_PATH).toBe("/reset-password");
    expect(authForm).not.toContain("next=/app/settings/profile");
  });

  it("valida tamanho mínimo e confirmação da senha", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validateNewPassword("short", "short")).toContain("8");
    expect(validateNewPassword("long-enough", "different")).toContain("não coincidem");
    expect(validateNewPassword("long-enough", "long-enough")).toBeUndefined();
  });

  it("atualiza senha somente com sessão Supabase e trata estados inválidos", () => {
    expect(page).toContain("PasswordRecoveryForm");
    expect(form).toContain("getSession");
    expect(form).toContain("updateUser({ password })");
    expect(form).toContain('setState("invalid")');
    expect(form).toContain("Link inválido ou expirado");
    expect(form).not.toContain("console.log");
  });

  it("mantém o callback seguro e sem loop para o perfil", () => {
    expect(callback).toContain("safeNextPath");
    expect(callback).not.toContain("app/settings/profile");
    expect(safeNextPath("//evil.example/reset")).toBe("/app");
    expect(safeNextPath("https://evil.example/reset")).toBe("/app");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
  });

  it("mantém login e cadastro usando os fluxos existentes", () => {
    expect(read("src/app/(auth)/login/page.tsx")).toContain('AuthForm mode="login"');
    expect(read("src/app/(auth)/register/page.tsx")).toContain('AuthForm mode="register"');
  });
});
