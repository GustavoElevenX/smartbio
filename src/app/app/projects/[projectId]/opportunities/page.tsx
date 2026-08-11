import type { Metadata } from "next";
import { OpportunitiesPage } from "@/components/opportunities/opportunities-page";
export const metadata: Metadata = { title: "Oportunidades" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <OpportunitiesPage projectId={projectId} />; }
