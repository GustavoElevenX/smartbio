import { redirect } from "next/navigation";

export default async function SitePage({ params }: PageProps<"/app/projects/[projectId]/site">) {
  const { projectId } = await params;
  redirect(`/app/projects/${projectId}/editor`);
}
