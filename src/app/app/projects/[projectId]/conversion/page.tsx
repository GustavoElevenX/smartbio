import type { Metadata } from "next";
import { ConversionPage } from "@/components/conversion/conversion-page";
export const metadata: Metadata = { title: "Conversão" };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <ConversionPage projectId={projectId} />; }
