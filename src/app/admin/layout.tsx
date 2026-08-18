import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/platform-admin/admin-shell";
import {
  AuthenticationRequiredError,
  EmailNotConfirmedError,
  ProductionConfigurationError,
  WorkspaceAccessDeniedError,
} from "@/server/auth/auth-errors";
import { requirePlatformAdmin } from "@/server/platform-admin/require-platform-admin";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let destination: string | null = null;
  let adminEmail = "";
  try {
    const admin = await requirePlatformAdmin();
    adminEmail = admin.email;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      destination = "/login?next=/admin";
    else if (error instanceof EmailNotConfirmedError)
      destination = "/confirm-email";
    else if (error instanceof WorkspaceAccessDeniedError)
      destination = "/auth/error?code=admin_access_denied";
    else if (error instanceof ProductionConfigurationError)
      destination = "/auth/error?code=service_unavailable";
    else throw error;
  }
  if (destination) redirect(destination);
  return <AdminShell adminEmail={adminEmail}>{children}</AdminShell>;
}
