import type { Metadata } from "next";
import { MySobe } from "@/components/dashboard/my-sobe";

export const metadata: Metadata = { title: "Minha SOBE" };

export default async function Page({ params }: PageProps<"/app/projects/[projectId]/minha-sobe">) {
  const { projectId } = await params;
  return <MySobe projectId={projectId} />;
}
