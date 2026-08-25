import type { Metadata } from "next";
import { AISetupShell } from "@/components/ai-setup/ai-setup-shell";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { getActivationPreflight } from "@/server/ai-setup/activation-preflight";

export const metadata: Metadata = { title: "Onboarding adaptativo" };

type AIOnboardingPageProps = {
  searchParams: Promise<{ new?: string | string[] }>;
};

export default async function AIOnboardingPage({ searchParams }: AIOnboardingPageProps) {
  const [params, actor] = await Promise.all([searchParams, requireAuthenticatedActor()]);
  const preflight = await getActivationPreflight(actor);
  return (
    <AISetupShell
      startFresh={params.new === "1"}
      initialPreflight={preflight}
      workspaceId={actor.workspaceId}
    />
  );
}
