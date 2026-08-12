import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CustomerHistoryImport } from "@/components/activations/customer-history-import";

export const metadata: Metadata = { title: "Histórico de clientes · Virou" };

export default async function Page({ params }: PageProps<"/app/projects/[projectId]/activations/eligibility">) {
  const { projectId } = await params;
  return <div><Link href={`/app/projects/${projectId}/activations`} className="inline-flex items-center gap-2 text-sm font-bold text-[#6150c8]"><ArrowLeft size={16} />Voltar para ativações</Link><header className="mt-6 max-w-3xl"><p className="text-sm font-bold text-[#6655dd]">Elegibilidade</p><h1 className="mt-2 text-4xl font-extrabold tracking-[-.045em]">Reconheça quem já comprou.</h1><p className="mt-3 text-[#6e6e78]">Conecte evidência histórica sem expor dados de clientes na experiência pública.</p></header><div className="mt-8"><CustomerHistoryImport projectId={projectId} /></div></div>;
}
