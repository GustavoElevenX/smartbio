import "server-only";

export const ACTIVE_WORKSPACE_COOKIE = "smartbio_active_workspace";

export function activeWorkspaceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
