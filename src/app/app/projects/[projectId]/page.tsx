import type { Metadata } from "next";
import { BusinessOverview } from "@/components/dashboard/business-overview";

export const metadata: Metadata = { title: "Visão geral" };
export default async function ProjectPage({ params }: PageProps<"/app/projects/[projectId]">) { const { projectId } = await params; return <BusinessOverview projectId={projectId} />; }
