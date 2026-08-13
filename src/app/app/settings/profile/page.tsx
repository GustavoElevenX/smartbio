import type { Metadata } from "next";
import { ProfileSettingsReal } from "@/components/account/account-settings-real";
export const metadata: Metadata = { title: "Perfil" };
export default function ProfilePage() {
  return <ProfileSettingsReal />;
}
