import type { Metadata } from "next";
import { ProjectSettings } from "@/components/dashboard/settings-panels";
export const metadata: Metadata = { title: "Configurações do projeto" };
export default async function ProjectSettingsPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <ProjectSettings projectId={projectId} />; }
