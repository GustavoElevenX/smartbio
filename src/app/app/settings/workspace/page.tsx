import type { Metadata } from "next";
import { WorkspaceSettings } from "@/components/dashboard/settings-panels";
export const metadata: Metadata = { title: "Workspace" };
export default function WorkspacePage() { return <WorkspaceSettings />; }
