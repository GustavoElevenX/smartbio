import type { Metadata } from "next";
import { SiteEditor } from "@/components/presence-editor/site-editor";

export const metadata: Metadata = { title: "Site" };
export default async function SitePage({ params }: PageProps<"/app/projects/[projectId]/site">) { const { projectId } = await params; return <SiteEditor projectId={projectId} />; }
