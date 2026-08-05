import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  AuthenticationRequiredError,
  EmailNotConfirmedError,
  ProductionConfigurationError,
  WorkspaceRequiredError,
} from "@/server/auth/auth-errors";
import { requireAuthenticatedActor } from "@/server/auth/setup-actor";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let destination: string | null = null;
  try {
    await requireAuthenticatedActor();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) destination = "/login?next=/app";
    else if (error instanceof EmailNotConfirmedError) destination = "/confirm-email";
    else if (error instanceof WorkspaceRequiredError) destination = "/auth/error?code=workspace_required";
    else if (error instanceof ProductionConfigurationError) destination = "/auth/error?code=configuration";
    else throw error;
  }
  if (destination) redirect(destination);
  return <DashboardShell>{children}</DashboardShell>;
}
