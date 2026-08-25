import { normalizePhone } from "@/features/customer-identity/normalize-phone";

export interface SetupPhoneResult {
  valid: boolean;
  normalized?: string;
  error?: string;
}

export function validateSetupPhone(
  value: string | undefined,
  country = "BR",
): SetupPhoneResult {
  const phone = value?.trim();
  if (!phone) return { valid: true };
  try {
    return { valid: true, normalized: normalizePhone(phone, country) };
  } catch {
    return {
      valid: false,
      error: "Confira o número. Use DDD + telefone.",
    };
  }
}

export function normalizeSetupPhone(value: string | undefined) {
  const result = validateSetupPhone(value);
  if (!result.valid) throw new Error(result.error);
  return result.normalized;
}
