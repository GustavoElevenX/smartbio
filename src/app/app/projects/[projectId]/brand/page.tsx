import type { Metadata } from "next";
import { BrandStudio } from "@/components/dashboard/brand-studio";
export const metadata: Metadata = { title: "Marca" };
export default async function BrandPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <BrandStudio projectId={projectId} />; }
