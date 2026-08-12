import { z } from "zod";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const schema = z.object({ preferences: z.array(z.object({ eventKey: z.string().min(1).max(100), inApp: z.boolean(), email: z.boolean() })).max(30) });

export const GET = withAuthenticatedActor(async (_request, _context, actor) => {
  if (actor.persistence === "memory") return Response.json({ data: [] });
  return Response.json({ data: await notificationRepository.preferences(actor.workspaceId, actor.userId) });
});

export const PUT = withAuthenticatedActor(async (request, _context, actor) => {
  const { preferences } = schema.parse(await request.json());
  if (actor.persistence === "memory") {
    return Response.json({
      data: preferences.map((item) => ({
        id: item.eventKey,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        eventKey: item.eventKey,
        inApp: item.inApp,
        email: item.email,
      })),
    });
  }
  return Response.json({ data: await notificationRepository.savePreferences(actor.workspaceId, actor.userId, preferences) });
});
