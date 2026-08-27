export const RECOVERY_REDIRECT_PATH = "/reset-password";
export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "Use uma senha com pelo menos 8 caracteres.";
  }
  if (password !== confirmation) {
    return "As senhas não coincidem.";
  }
  return undefined;
}
