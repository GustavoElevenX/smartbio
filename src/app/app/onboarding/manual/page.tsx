import type { Metadata } from "next";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Configuração manual" };

export default function ManualOnboardingPage() { return <OnboardingWizard />; }
