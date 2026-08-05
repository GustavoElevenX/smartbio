import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";

const storageKey = "smartbio:last-ai-setup-session";

export function rememberAISetupSession(session: AISetupSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

export function readRememberedAISetupSession(): AISetupSession | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(storageKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as AISetupSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function forgetAISetupSession() {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey);
}
