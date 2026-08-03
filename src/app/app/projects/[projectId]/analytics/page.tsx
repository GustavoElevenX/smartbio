import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/dashboard/analytics-dashboard";
export const metadata: Metadata = { title: "Analytics" };
export default async function AnalyticsPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <AnalyticsDashboard projectId={projectId} />; }
