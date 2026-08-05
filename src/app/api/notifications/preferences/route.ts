import { z } from "zod";
import { notificationRepository } from "@/server/notifications/notification-repository";
import { withAuthenticatedActor } from "@/server/http/with-authenticated-actor";
const schema = z.object({ preferences: z.array(z.object({ eventKey: z.string().min(1).max(100), inApp: z.boolean(), email: z.boolean() })).max(30) });
export const GET = withAuthenticatedActor(async (_request, _context, actor) => Response.json({ data: await notificationRepository.preferences(actor.workspaceId, actor.userId) }));
export const PUT = withAuthenticatedActor(async (request, _context, actor) => Response.json({ data: await notificationRepository.savePreferences(actor.workspaceId, actor.userId, schema.parse(await request.json()).preferences) }));
