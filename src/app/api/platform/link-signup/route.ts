import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { apiSuccess } from "@/server/http/api-response";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
import { linkAuthAttribution, PLATFORM_SESSION_COOKIE, PLATFORM_VISITOR_COOKIE } from "@/server/platform-acquisition/platform-acquisition";

export const POST = withAuthenticatedActor(async (_request, _context, actor) => {
  const store = await cookies();
  await linkAuthAttribution(createServiceClient()!, {
    userId: actor.userId,
    workspaceId: actor.workspaceId,
    visitorCookie: store.get(PLATFORM_VISITOR_COOKIE)?.value,
    sessionCookie: store.get(PLATFORM_SESSION_COOKIE)?.value,
  });
  return apiSuccess({ linked: true });
});
