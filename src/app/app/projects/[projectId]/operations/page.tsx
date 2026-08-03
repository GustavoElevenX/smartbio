import type { Metadata } from "next";
import { CommercialOperations } from "@/components/dashboard/commercial-operations";

export const metadata: Metadata = { title: "Operação comercial" };

export default async function OperationsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <CommercialOperations projectId={projectId} />;
}
