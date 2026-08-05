import type { Metadata } from "next";
import { NotificationPreferences } from "@/components/notifications/notification-preferences";
export const metadata: Metadata = { title: "Preferências de notificação" };
export default function Page() { return <NotificationPreferences />; }
