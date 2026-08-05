import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";
export const metadata: Metadata = { title: "Notificações" };
export default function Page() { return <NotificationsPage />; }
