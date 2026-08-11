import type { Metadata } from "next";
import { AISetupShell } from "@/components/ai-setup/ai-setup-shell";

export const metadata: Metadata = { title: "Onboarding adaptativo" };

type AIOnboardingPageProps = {
  searchParams: Promise<{ new?: string | string[] }>;
};

export default async function AIOnboardingPage({ searchParams }: AIOnboardingPageProps) {
  const params = await searchParams;
  return <AISetupShell startFresh={params.new === "1"} />;
}
