import type { Metadata } from "next";
import { LeadsDashboard } from "@/components/dashboard/leads-dashboard";
export const metadata: Metadata = { title: "Leads" };
export default async function LeadsPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <LeadsDashboard projectId={projectId} />; }
