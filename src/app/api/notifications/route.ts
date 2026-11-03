import { z } from "zod";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { materializeUserNotifications } from "@/server/notifications/notification-materializer";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";

const patchSchema = z.object({ ids: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() });

export const GET = withAuthenticatedActor(async (request, _context, actor) => {
  if (actor.persistence === "memory") return Response.json({ data: [], unread: 0 });
  const filter = new URL(request.url).searchParams.get("filter") === "unread" ? "unread" : "all";
  await materializeUserNotifications(actor.workspaceId, actor.userId).catch((error) => {
    console.error("notification_materialization_failed", {
      workspaceId: actor.workspaceId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  });
  const data = await notificationRepository.list(actor.workspaceId, actor.userId, filter);
  return Response.json({ data, unread: data.filter((item) => !item.readAt).length });
});

export const PATCH = withAuthenticatedActor(async (request, _context, actor) => {
  const input = patchSchema.parse(await request.json());
  if (actor.persistence === "database") {
    await notificationRepository.markRead(actor.workspaceId, actor.userId, input.all ? undefined : input.ids);
  }
  return Response.json({ data: { updated: true } });
});
