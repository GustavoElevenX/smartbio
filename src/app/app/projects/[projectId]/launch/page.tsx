import type { Metadata } from "next";
import { ProjectLaunchReview } from "@/components/launch/project-launch-review";

export const metadata: Metadata = { title: "Sua primeira versão" };

export default async function LaunchPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectLaunchReview projectId={projectId} />;
}
