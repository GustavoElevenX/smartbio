import type { Metadata } from "next";
import { WorkspaceSettingsReal } from "@/components/account/account-settings-real";
export const metadata: Metadata = { title: "Workspace" };
export default function WorkspacePage() {
  return <WorkspaceSettingsReal />;
}
