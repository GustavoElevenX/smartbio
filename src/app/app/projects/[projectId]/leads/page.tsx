import { redirect } from "next/navigation";

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/app/projects/${projectId}/opportunities`);
}
