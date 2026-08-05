import { z } from "zod";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
const patchSchema = z.object({ ids: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() });
export const GET = withAuthenticatedActor(async (request, _context, actor) => { const filter = new URL(request.url).searchParams.get("filter") === "unread" ? "unread" : "all"; const data = await notificationRepository.list(actor.workspaceId, actor.userId, filter); return Response.json({ data, unread: data.filter((item) => !item.readAt).length }); });
export const PATCH = withAuthenticatedActor(async (request, _context, actor) => { const input = patchSchema.parse(await request.json()); await notificationRepository.markRead(actor.workspaceId, actor.userId, input.all ? undefined : input.ids); return Response.json({ data: { updated: true } }); });
