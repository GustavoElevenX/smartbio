import type { Metadata } from "next";
import { AISetupShell } from "@/components/ai-setup/ai-setup-shell";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { getActivationPreflight } from "@/server/ai-setup/activation-preflight";
import { loadProjectForActor } from "@/server/projects/load-project-for-actor";
import type { AISetupDraft } from "@/features/ai-setup/ai-setup-state";

export const metadata: Metadata = { title: "Configuração inicial adaptativa" };

type AIOnboardingPageProps = {
  searchParams: Promise<{ new?: string | string[]; basedOn?: string | string[] }>;
};

export default async function AIOnboardingPage({ searchParams }: AIOnboardingPageProps) {
  const [params, actor] = await Promise.all([searchParams, requireAuthenticatedActor()]);
  const preflight = await getActivationPreflight(actor);
  const sourceId = typeof params.basedOn === "string" ? params.basedOn : undefined;
  const source = sourceId ? await loadProjectForActor(actor, sourceId) : null;
  const initialDraft: AISetupDraft | undefined = source ? {
    businessName: source.name,
    description: source.description,
    phone: source.phone || "",
    websiteUrl: "",
    ...(source.phone && /whatsapp/i.test(source.primaryDestination) ? { salesChannel: "whatsapp" as const } : {}),
  } : undefined;
  return (
    <AISetupShell
      startFresh={params.new === "1" || Boolean(source)}
      initialDraft={initialDraft}
      initialPreflight={preflight}
      workspaceId={actor.workspaceId}
    />
  );
}
