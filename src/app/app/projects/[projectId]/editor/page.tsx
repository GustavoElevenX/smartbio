import type { Metadata } from "next";
import { ExperienceEditor } from "@/components/editor/experience-editor";
export const metadata: Metadata = { title: "Editor" };
export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; return <ExperienceEditor projectId={projectId} />; }
