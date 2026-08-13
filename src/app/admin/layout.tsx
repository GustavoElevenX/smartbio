import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/platform-admin/admin-shell";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  try {
    await requirePlatformAdmin();
  } catch {
    notFound();
  }
  return <AdminShell>{children}</AdminShell>;
}
