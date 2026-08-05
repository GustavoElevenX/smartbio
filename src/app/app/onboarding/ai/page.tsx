import type { Metadata } from "next";
import { AISetupShell } from "@/components/ai-setup/ai-setup-shell";

export const metadata: Metadata = { title: "Onboarding adaptativo" };

export default function AIOnboardingPage() { return <AISetupShell />; }
