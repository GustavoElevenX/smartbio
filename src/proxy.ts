import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_FEATURE_CONTENT_STUDIO === "false" &&
    /^\/api\/projects\/[^/]+\/(?:content|social\/instagram)(?:\/|$)/.test(request.nextUrl.pathname)) {
    return NextResponse.json({ ok: false, error: { code: "feature_disabled", message: "SOBE Conteúdo está desativado." } }, { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
