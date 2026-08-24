import type { Metadata } from "next";
import { Overview } from "@/components/dashboard/overview";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";
import { getWorkspaceOperationalOverview } from "@/server/dashboard/overview-service";
export const metadata: Metadata = { title: "Visão geral" };
export default async function DashboardPage() {
  const actor = await requireAuthenticatedActor();
  const overview = await getWorkspaceOperationalOverview(actor);
  return <Overview overview={overview} />;
}
