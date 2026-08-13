import type { Metadata } from "next";
import { BillingSettingsReal } from "@/components/entitlements/billing-settings-real";
export const metadata: Metadata = { title: "Plano e cobrança" };
export default function BillingPage() { return <BillingSettingsReal />; }
