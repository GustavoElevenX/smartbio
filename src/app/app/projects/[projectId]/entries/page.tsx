import type { Metadata } from "next";
import { EntryPointsPage } from "@/components/entry-points/entry-points-page";
export const metadata: Metadata = { title: "Entradas" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <EntryPointsPage projectId={projectId} />; }
