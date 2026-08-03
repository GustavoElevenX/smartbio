import type { Metadata } from "next";
import { ProfileSettings } from "@/components/dashboard/settings-panels";
export const metadata: Metadata = { title: "Perfil" };
export default function ProfilePage() { return <ProfileSettings />; }
