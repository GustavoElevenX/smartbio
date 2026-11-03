import type { Metadata } from "next";
import { WorkspaceSettingsReal } from "@/components/account/account-settings-real";
export const metadata: Metadata = { title: "Espaço de trabalho" };
export default function WorkspacePage() {
  return <WorkspaceSettingsReal />;
}
