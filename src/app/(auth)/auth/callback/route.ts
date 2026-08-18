import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/safe-next";
import { createServiceClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/server/auth/workspace-bootstrap";
import {
  linkAuthAttribution,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_VISITOR_COOKIE,
  recordPlatformGrowthEvent,
} from "@/server/platform-acquisition/platform-acquisition";

export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const errorUrl = new URL("/auth/error?code=invalid_callback", request.url);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!code || !url || !anonKey) return NextResponse.redirect(errorUrl);

  const response = NextResponse.redirect(new URL(next, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(errorUrl);
  const database = createServiceClient();
  if (database) {
    try {
      const workspace = await ensureUserWorkspace(data.user);
      await linkAuthAttribution(database, {
        userId: data.user.id,
        workspaceId: workspace.workspaceId,
        visitorCookie: request.cookies.get(PLATFORM_VISITOR_COOKIE)?.value,
        sessionCookie: request.cookies.get(PLATFORM_SESSION_COOKIE)?.value,
      });
      await recordPlatformGrowthEvent(database, {
        eventName: "email_confirmed",
        userId: data.user.id,
        workspaceId: workspace.workspaceId,
        idempotencyKey: `email_confirmed:${data.user.id}`,
      });
    } catch (trackingError) {
      console.warn("platform_attribution_link_failed", trackingError);
    }
  }
  return response;
}
