import { z } from "zod";
import type { AISetupSession } from "@/features/ai-setup/ai-setup.schema";

export const AI_SETUP_STORAGE_KEY = "smartbio:last-ai-setup-session";

const draftSchema = z.object({
  businessName: z.string().max(160),
  description: z.string().max(4000),
  websiteUrl: z.string().max(1000),
  phone: z.string().max(40),
});

const pointerSchema = z.object({
  version: z.literal(2),
  sessionId: z.string().min(1),
  workspaceId: z.string().min(1),
  draft: draftSchema.optional(),
});

const legacySessionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  initialInput: z.object({
    businessName: z.string().max(160).catch(""),
    description: z.string().max(4000).catch(""),
    websiteUrl: z.string().max(1000).optional(),
    phone: z.string().max(40).optional(),
  }),
});

export type AISetupDraft = z.infer<typeof draftSchema>;
export type RememberedAISetupSession = z.infer<typeof pointerSchema> & {
  legacy?: boolean;
};

export function parseRememberedAISetupSession(
  raw: string,
  workspaceId: string,
): RememberedAISetupSession | null {
  try {
    const candidate = JSON.parse(raw) as unknown;
    const pointer = pointerSchema.safeParse(candidate);
    if (pointer.success)
      return pointer.data.workspaceId === workspaceId ? pointer.data : null;

    const legacy = legacySessionSchema.safeParse(candidate);
    if (!legacy.success || legacy.data.workspaceId !== workspaceId) return null;
    return {
      version: 2,
      sessionId: legacy.data.id,
      workspaceId: legacy.data.workspaceId,
      draft: {
        businessName: legacy.data.initialInput.businessName,
        description: legacy.data.initialInput.description,
        websiteUrl: legacy.data.initialInput.websiteUrl || "",
        phone: legacy.data.initialInput.phone || "",
      },
      legacy: true,
    };
  } catch {
    return null;
  }
}

export function rememberAISetupSession(
  session: AISetupSession,
  draft?: AISetupDraft,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    AI_SETUP_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      sessionId: session.id,
      workspaceId: session.workspaceId,
      ...(draft ? { draft } : {}),
    } satisfies z.infer<typeof pointerSchema>),
  );
}

export function rememberAISetupDraft(
  session: AISetupSession,
  draft: AISetupDraft,
) {
  rememberAISetupSession(session, draft);
}

export function readRememberedAISetupSession(
  workspaceId: string,
): RememberedAISetupSession | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(AI_SETUP_STORAGE_KEY);
  if (!value) return null;
  const parsed = parseRememberedAISetupSession(value, workspaceId);
  if (!parsed) window.localStorage.removeItem(AI_SETUP_STORAGE_KEY);
  return parsed;
}

export function forgetAISetupSession() {
  if (typeof window !== "undefined")
    window.localStorage.removeItem(AI_SETUP_STORAGE_KEY);
}
